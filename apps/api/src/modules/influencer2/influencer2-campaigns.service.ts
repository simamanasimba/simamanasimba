import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Influencer2CampaignStatus, Influencer2ContentType, Influencer2MetricCategory, Prisma } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateInfluencer2CampaignDto } from "./dto/create-influencer2-campaign.dto";
import { UpdateInfluencer2CampaignDto } from "./dto/update-influencer2-campaign.dto";
import { AddCampaignPlatformDto } from "./dto/add-campaign-platform.dto";
import { UpdateCampaignPlatformDto } from "./dto/update-campaign-platform.dto";
import { SubmitMetricsDto } from "./dto/submit-metrics.dto";

interface PlatformMetricSummary {
  metricDefinitionId: string;
  key: string;
  label: string;
  category: Influencer2MetricCategory;
  unit: string | null;
  countsAsEngagement: boolean;
  value: number;
  collectedAt: Date;
}

interface PlatformSummary {
  campaignPlatformId: string;
  platformId: string;
  platformKey: string;
  platformName: string;
  postUrl: string | null;
  postId: string | null;
  publishedAt: Date | null;
  metrics: PlatformMetricSummary[];
  totalEngagement: number;
  sentiment: { positive: number | null; negative: number | null; neutral: number | null } | null;
}

const dateOrUndefined = (v?: string) => (v ? new Date(v) : undefined);

/** rateTzs/totalTzs are Prisma Decimal — same documented conversion applied everywhere else in
 * this codebase (MediaEngagement.rateTzs/totalTzs), otherwise they'd serialize as JSON strings and
 * silently break frontend arithmetic. */
function toNumericCampaign<T extends { rateTzs: Prisma.Decimal | null; totalTzs: Prisma.Decimal | null }>(campaign: T) {
  return { ...campaign, rateTzs: campaign.rateTzs != null ? Number(campaign.rateTzs) : null, totalTzs: campaign.totalTzs != null ? Number(campaign.totalTzs) : null };
}

@Injectable()
export class Influencer2CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The campaign-facing payment label the user actually wants ("Unpaid"/"Pending Payment"/"Paid")
   * instead of the unrelated lifecycle `status` (DRAFT/ACTIVE/...), which was never a payment
   * signal. PAID mirrors the campaign's own paymentStatus (only set once PaymentsService.markPaid
   * actually records the money as sent); PENDING_PAYMENT means an admin has approved a payment
   * against this campaign but Finance hasn't paid it yet; everything else reads as UNPAID. */
  private paymentProgress(paymentStatus: "NOT_PAID" | "PAID", hasApprovedPayment: boolean): "UNPAID" | "PENDING_PAYMENT" | "PAID" {
    if (paymentStatus === "PAID") return "PAID";
    return hasApprovedPayment ? "PENDING_PAYMENT" : "UNPAID";
  }

  /** We pay by week, not by post — several posts can share one agreement week, and that week gets
   * paid (or not) as a whole through its evaluation's ticket, never post by post. So for any post
   * tagged with agreementWeekNumber, paid/unpaid is a property of its WEEK, looked up here, not the
   * per-campaign paymentStatus/approved-payment check paymentProgress() above still does for posts
   * with no agreement (or that predate week-tagging), which keeps working exactly as before. */
  private async resolveWeeklyProgress(
    organizationId: string,
    rows: Array<{ id: string; mediaHostId: string | null; influencerId: string | null; agreementWeekNumber: number | null }>,
  ): Promise<Map<string, "UNPAID" | "PENDING_PAYMENT" | "PAID">> {
    const tagged = rows.filter((r) => r.agreementWeekNumber != null);
    const result = new Map<string, "UNPAID" | "PENDING_PAYMENT" | "PAID">();
    if (tagged.length === 0) return result;

    const hostIds = [...new Set(tagged.map((r) => r.mediaHostId).filter((v): v is string => Boolean(v)))];
    const influencerIds = [...new Set(tagged.map((r) => r.influencerId).filter((v): v is string => Boolean(v)))];
    if (hostIds.length === 0 && influencerIds.length === 0) return result;

    const agreements = await this.prisma.postingAgreement.findMany({
      where: { organizationId, OR: [{ mediaHostId: { in: hostIds } }, { influencerId: { in: influencerIds } }] },
    });
    if (agreements.length === 0) return result;
    const agreementByHost = new Map(agreements.filter((a) => a.mediaHostId).map((a) => [a.mediaHostId as string, a]));
    const agreementByInfluencer = new Map(agreements.filter((a) => a.influencerId).map((a) => [a.influencerId as string, a]));

    const evaluations = await this.prisma.postingAgreementEvaluation.findMany({
      where: { agreementId: { in: agreements.map((a) => a.id) } },
      include: { payment: { select: { status: true } } },
    });
    const evalByKey = new Map(evaluations.map((e) => [`${e.agreementId}:${e.weekNumber}`, e]));

    for (const r of tagged) {
      const agreement = r.mediaHostId ? agreementByHost.get(r.mediaHostId) : r.influencerId ? agreementByInfluencer.get(r.influencerId) : undefined;
      if (!agreement) continue; // agreement was deleted since this post was tagged — falls back to per-campaign logic
      const status = evalByKey.get(`${agreement.id}:${r.agreementWeekNumber}`)?.payment?.status;
      result.set(r.id, status === "PAID" ? "PAID" : status === "PROCESSING" ? "PENDING_PAYMENT" : "UNPAID");
    }
    return result;
  }

  private async ensure(organizationId: string, id: string) {
    const campaign = await this.prisma.influencer2Campaign.findFirst({ where: { id, organizationId } });
    if (!campaign) throw new NotFoundException("Campaign not found");
    return campaign;
  }

  private async ensureCampaignPlatform(organizationId: string, campaignId: string, campaignPlatformId: string) {
    const cp = await this.prisma.influencer2CampaignPlatform.findFirst({
      where: { id: campaignPlatformId, campaignId },
      include: { campaign: true, platform: true },
    });
    if (!cp || cp.campaign.organizationId !== organizationId) throw new NotFoundException("Campaign platform not found");
    return cp;
  }

  private summarizePlatform(cp: {
    id: string;
    platformId: string;
    postUrl: string | null;
    postId: string | null;
    publishedAt: Date | null;
    platform: { key: string; name: string };
    metrics: Array<{ value: Prisma.Decimal; collectedAt: Date; metricDefinition: { id: string; key: string; label: string; category: Influencer2MetricCategory; unit: string | null; countsAsEngagement: boolean } }>;
  }): PlatformSummary {
    const metrics: PlatformMetricSummary[] = cp.metrics.map((m) => ({
      metricDefinitionId: m.metricDefinition.id,
      key: m.metricDefinition.key,
      label: m.metricDefinition.label,
      category: m.metricDefinition.category,
      unit: m.metricDefinition.unit,
      countsAsEngagement: m.metricDefinition.countsAsEngagement,
      value: Number(m.value),
      collectedAt: m.collectedAt,
    }));
    const totalEngagement = metrics.filter((m) => m.countsAsEngagement).reduce((sum, m) => sum + m.value, 0);
    const positive = metrics.find((m) => m.key === "comments_positive")?.value ?? null;
    const negative = metrics.find((m) => m.key === "comments_negative")?.value ?? null;
    const neutral = metrics.find((m) => m.key === "comments_neutral")?.value ?? null;
    const hasSentiment = positive != null || negative != null || neutral != null;

    return {
      campaignPlatformId: cp.id,
      platformId: cp.platformId,
      platformKey: cp.platform.key,
      platformName: cp.platform.name,
      postUrl: cp.postUrl,
      postId: cp.postId,
      publishedAt: cp.publishedAt,
      metrics,
      totalEngagement,
      sentiment: hasSentiment ? { positive, negative, neutral } : null,
    };
  }

  /** Campaign-level totals — bucketed by category, skipping (not zero-filling)
   * any bucket nothing was entered for, per the explicit "do not invent or
   * estimate missing values" requirement. Sentiment is stored as a PERCENT
   * of each platform's own comments (must sum to 100 per platform), so the
   * campaign-wide figure is a comment-count-weighted average across
   * platforms, not a sum — summing percentages from different platforms
   * would produce a meaningless number over 100. */
  private aggregateTotals(platforms: PlatformSummary[]) {
    let totalViews = 0, totalLikes = 0, totalComments = 0, totalShares = 0, totalEngagement = 0;
    let sentPositiveWeighted = 0, sentNegativeWeighted = 0, sentNeutralWeighted = 0, sentimentWeight = 0;
    let hasViews = false, hasLikes = false, hasComments = false, hasShares = false;

    for (const p of platforms) {
      totalEngagement += p.totalEngagement;
      const commentsCount = p.metrics.find((m) => m.category === "COMMENTS")?.value ?? 0;
      for (const m of p.metrics) {
        if (m.category === "VIEWS") { totalViews += m.value; hasViews = true; }
        else if (m.category === "LIKES") { totalLikes += m.value; hasLikes = true; }
        else if (m.category === "COMMENTS") { totalComments += m.value; hasComments = true; }
        else if (m.category === "SHARES") { totalShares += m.value; hasShares = true; }
      }
      if (p.sentiment && commentsCount > 0) {
        sentimentWeight += commentsCount;
        sentPositiveWeighted += (p.sentiment.positive ?? 0) * commentsCount;
        sentNegativeWeighted += (p.sentiment.negative ?? 0) * commentsCount;
        sentNeutralWeighted += (p.sentiment.neutral ?? 0) * commentsCount;
      }
    }

    return {
      platformCount: platforms.length,
      totalViews: hasViews ? totalViews : null,
      totalLikes: hasLikes ? totalLikes : null,
      totalComments: hasComments ? totalComments : null,
      totalShares: hasShares ? totalShares : null,
      totalEngagement,
      sentiment:
        sentimentWeight > 0
          ? {
              positive: Math.round((sentPositiveWeighted / sentimentWeight) * 10) / 10,
              negative: Math.round((sentNegativeWeighted / sentimentWeight) * 10) / 10,
              neutral: Math.round((sentNeutralWeighted / sentimentWeight) * 10) / 10,
            }
          : null,
    };
  }

  private async resolveInfluencerNames(organizationId: string, ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map<string, string>();
    const rows = await this.prisma.influencer.findMany({ where: { id: { in: unique }, organizationId }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private async resolveMediaHostNames(organizationId: string, ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map<string, string>();
    const rows = await this.prisma.mediaHost.findMany({ where: { id: { in: unique }, organizationId }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** Which posts count toward one agreement week: tagged with that exact weekNumber, OR untagged
   * (predates the tagging feature, or the beneficiary has no agreement) and created within the
   * week's own date range as a fallback. Shared by list() (the "View posts" drill-down) and
   * weeklyAssessment() (the actual evaluation totals) so both agree on the same post set. */
  private weekMatchFilter(weekNumber: number, from: Date, to: Date): Prisma.Influencer2CampaignWhereInput {
    return { OR: [{ agreementWeekNumber: weekNumber }, { agreementWeekNumber: null, createdAt: { gte: from, lte: to } }] };
  }

  /** Which posts count toward one folder ("campaign"): explicitly filed under it (folderId), OR
   * unfiled and published within the folder's own [startDate, endDate] if it has one — the
   * "detect start and end, group by published date" auto-grouping. A folder with no date range
   * set only ever picks up explicitly-filed posts. Shared by folderAssessment() (evaluation
   * totals) and list()'s folder drill-down so both agree on the same post set. */
  private folderMatchFilter(folderId: string, startDate: Date | null, endDate: Date | null): Prisma.Influencer2CampaignWhereInput {
    const conditions: Prisma.Influencer2CampaignWhereInput[] = [{ folderId }];
    if (startDate && endDate) conditions.push({ folderId: null, ...this.publishedDateFilter(startDate, endDate) });
    return { OR: conditions };
  }

  /** A "weekly report" means "what was PUBLISHED this week" — not "what got typed into the system
   * this week." Data entry commonly lags behind the actual post (someone adds Monday's post on
   * Wednesday), so filtering by createdAt silently dropped real posts from the window they were
   * actually published in. Matches a platform's own publishedAt falling in range, falling back to
   * that platform's createdAt only when publishedAt was never set at all. Used everywhere a
   * dashboard/report scopes campaigns to a date range — never for the explicit agreementWeekNumber
   * tag above, which is a deliberate, higher-precision signal of its own. */
  private publishedPlatformFilter(from: Date, to: Date): Prisma.Influencer2CampaignPlatformWhereInput {
    return {
      OR: [
        { publishedAt: { gte: from, lte: to } },
        { publishedAt: null, createdAt: { gte: from, lte: to } },
      ],
    };
  }

  /** "This campaign has at least one platform published in range" — the right question for
   * whether a POST belongs in a given week's report. Metric totals need the stricter, per-platform
   * version above instead (a campaign with one platform published this week and another published
   * last week must only count the first platform's numbers toward this week). */
  private publishedDateFilter(from: Date, to: Date): Prisma.Influencer2CampaignWhereInput {
    return { platforms: { some: this.publishedPlatformFilter(from, to) } };
  }

  async list(
    organizationId: string,
    filters: {
      influencerId?: string;
      mediaHostId?: string;
      platformKey?: string;
      contentType?: Influencer2ContentType;
      status?: Influencer2CampaignStatus;
      paymentStatus?: "NOT_PAID" | "PAID";
      from?: Date;
      to?: Date;
      weekNumber?: number;
      folderId?: string;
      folderStart?: Date;
      folderEnd?: Date;
      search?: string;
    },
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.Influencer2CampaignWhereInput = { organizationId };
    if (filters.search?.trim()) {
      // No `mode: "insensitive"` — that's Postgres-only in Prisma; MySQL's default collation is
      // already case-insensitive, same reasoning as members.service.ts's own free-text search.
      const search = filters.search.trim();
      where.OR = [{ name: { contains: search } }, { code: { contains: search } }];
    }
    if (filters.influencerId) where.influencerId = filters.influencerId;
    if (filters.mediaHostId) where.mediaHostId = filters.mediaHostId;
    if (filters.contentType) where.contentType = filters.contentType;
    if (filters.status) where.status = filters.status;
    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
      // We pay by week/campaign, not by post — a post tagged to an agreement week OR filed under a
      // campaign folder is paid (or not) as part of that group's ticket, never picked individually
      // here, so "unpaid campaigns to pay" (the Record Payment beneficiary flow) must never surface
      // one. Untagged posts (no agreement, no folder, or predate tagging) are unaffected and still
      // show up exactly as before.
      if (filters.paymentStatus === "NOT_PAID") {
        where.agreementWeekNumber = null;
        where.folderId = null;
      }
    }
    if (filters.folderId) {
      // The "campaign-wise" drill-down — same set folderAssessment() totals up, so what's shown
      // here always agrees with the Campaigns panel's numbers.
      Object.assign(where, this.folderMatchFilter(filters.folderId, filters.folderStart ?? null, filters.folderEnd ?? null));
      if (filters.platformKey) where.platforms = { some: { platform: { key: filters.platformKey } } };
    } else if (filters.weekNumber != null && filters.from && filters.to) {
      // The explicit per-post week tag (or its createdAt fallback) — a different, higher-
      // precision signal than "published in range" below, used only for the posting-agreement
      // week drill-down.
      Object.assign(where, this.weekMatchFilter(filters.weekNumber, filters.from, filters.to));
      if (filters.platformKey) where.platforms = { some: { platform: { key: filters.platformKey } } };
    } else {
      // platformKey and the published-date range both narrow the SAME `platforms.some` relation —
      // combined into one condition (rather than two separate `where.platforms` assignments, which
      // would just overwrite each other) so "posted on Instagram" and "published this week" can be
      // required together correctly.
      const platformConditions: Prisma.Influencer2CampaignPlatformWhereInput[] = [];
      if (filters.platformKey) platformConditions.push({ platform: { key: filters.platformKey } });
      if (filters.from && filters.to) {
        platformConditions.push({
          OR: [
            { publishedAt: { gte: filters.from, lte: filters.to } },
            { publishedAt: null, createdAt: { gte: filters.from, lte: filters.to } },
          ],
        });
      }
      if (platformConditions.length > 0) where.platforms = { some: { AND: platformConditions } };
    }

    const [rows, total] = await Promise.all([
      this.prisma.influencer2Campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          platforms: {
            include: { platform: true, metrics: { where: { isLatest: true }, include: { metricDefinition: true } } },
          },
        },
      }),
      this.prisma.influencer2Campaign.count({ where }),
    ]);

    const [influencerNameById, mediaHostNameById, approvedPayments, weeklyProgress] = await Promise.all([
      this.resolveInfluencerNames(organizationId, rows.map((r) => r.influencerId)),
      this.resolveMediaHostNames(organizationId, rows.map((r) => r.mediaHostId)),
      this.prisma.payment.findMany({
        where: { influencer2CampaignId: { in: rows.map((r) => r.id) }, status: "PROCESSING" },
        select: { influencer2CampaignId: true },
      }),
      this.resolveWeeklyProgress(organizationId, rows),
    ]);
    const approvedCampaignIds = new Set(approvedPayments.map((p) => p.influencer2CampaignId));

    const items = rows.map((row) => {
      const { platforms, ...campaign } = row;
      const summaries = platforms.map((p) => this.summarizePlatform(p));
      const beneficiaryName = campaign.influencerId
        ? (influencerNameById.get(campaign.influencerId) ?? null)
        : campaign.mediaHostId
          ? (mediaHostNameById.get(campaign.mediaHostId) ?? null)
          : null;
      return {
        campaign: {
          ...toNumericCampaign(campaign),
          paymentProgress: weeklyProgress.get(campaign.id) ?? this.paymentProgress(campaign.paymentStatus, approvedCampaignIds.has(campaign.id)),
        },
        influencerName: beneficiaryName,
        platformKeys: summaries.map((p) => p.platformKey),
        totals: this.aggregateTotals(summaries),
      };
    });

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async create(organizationId: string, dto: CreateInfluencer2CampaignDto, createdBy?: string) {
    const row = await this.prisma.influencer2Campaign.create({
      data: {
        organizationId,
        createdBy,
        name: dto.name,
        code: dto.code,
        contentType: dto.contentType,
        description: dto.description,
        contentDate: dateOrUndefined(dto.contentDate),
        contentOwner: dto.contentOwner,
        influencerId: dto.influencerId,
        mediaHostId: dto.mediaHostId,
        startDate: dateOrUndefined(dto.startDate),
        endDate: dateOrUndefined(dto.endDate),
        status: dto.status,
        notes: dto.notes,
        agreementWeekNumber: dto.agreementWeekNumber,
        folderId: dto.folderId,
      },
    });
    return toNumericCampaign(row);
  }

  async update(organizationId: string, id: string, dto: UpdateInfluencer2CampaignDto) {
    await this.ensure(organizationId, id);
    const row = await this.prisma.influencer2Campaign.update({
      where: { id },
      data: {
        ...dto,
        contentDate: dto.contentDate !== undefined ? dateOrUndefined(dto.contentDate) : undefined,
        startDate: dto.startDate !== undefined ? dateOrUndefined(dto.startDate) : undefined,
        endDate: dto.endDate !== undefined ? dateOrUndefined(dto.endDate) : undefined,
      },
    });
    return toNumericCampaign(row);
  }

  async delete(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    await this.prisma.influencer2Campaign.delete({ where: { id } });
    return { success: true };
  }

  /** Tags several posts with one agreement week in a single request — the one-at-a-time picker on
   * the post form works fine for a post added right after it goes up, but posts entered in a
   * batch (or retagged after the fact) need to be assignable together instead of opened one by
   * one. Silently ignores any id that isn't a real campaign in this org rather than failing the
   * whole batch over one bad id. */
  async bulkAssignWeek(organizationId: string, campaignIds: string[], weekNumber: number) {
    const result = await this.prisma.influencer2Campaign.updateMany({
      where: { id: { in: campaignIds }, organizationId },
      data: { agreementWeekNumber: weekNumber },
    });
    return { updated: result.count };
  }

  /** Same idea as bulkAssignWeek, for folders ("campaigns") — file several selected posts under
   * one campaign at once instead of opening each one's own form. */
  async bulkAssignFolder(organizationId: string, campaignIds: string[], folderId: string) {
    const result = await this.prisma.influencer2Campaign.updateMany({
      where: { id: { in: campaignIds }, organizationId },
      data: { folderId },
    });
    return { updated: result.count };
  }

  async setThumbnail(organizationId: string, id: string, thumbnailUrl: string) {
    await this.ensure(organizationId, id);
    return this.prisma.influencer2Campaign.update({ where: { id }, data: { thumbnailUrl } });
  }

  async getDetail(organizationId: string, id: string) {
    const campaign = await this.ensure(organizationId, id);

    const [platformRows, influencer, mediaHost] = await Promise.all([
      this.prisma.influencer2CampaignPlatform.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: "asc" },
        include: { platform: true, metrics: { where: { isLatest: true }, include: { metricDefinition: true } } },
      }),
      campaign.influencerId
        ? this.prisma.influencer.findFirst({ where: { id: campaign.influencerId, organizationId }, select: { id: true, name: true, socialHandle: true } })
        : Promise.resolve(null),
      campaign.mediaHostId
        ? this.prisma.mediaHost.findFirst({ where: { id: campaign.mediaHostId, organizationId }, select: { id: true, name: true } })
        : Promise.resolve(null),
    ]);

    const platforms = platformRows.map((p) => this.summarizePlatform(p));
    const [approvedPayment, weeklyProgress] = await Promise.all([
      this.prisma.payment.findFirst({ where: { influencer2CampaignId: id, status: "PROCESSING" }, select: { id: true } }),
      this.resolveWeeklyProgress(organizationId, [campaign]),
    ]);

    return {
      campaign: {
        ...toNumericCampaign(campaign),
        paymentProgress: weeklyProgress.get(campaign.id) ?? this.paymentProgress(campaign.paymentStatus, Boolean(approvedPayment)),
      },
      influencer,
      mediaHost,
      platforms,
      totals: this.aggregateTotals(platforms),
    };
  }

  /** Every metric total (summary/weeklyAssessment/folderAssessment/weekDefinitionAssessment) used
   * to compute this by pulling EVERY matching latest metric-value row over the network and summing
   * in JS — fine for a single week, but for "All time"/a wide custom range at org-wide scope that
   * could be tens of thousands of rows, which is exactly why those ranges were slow. Summing is
   * pushed down to MySQL instead via groupBy (one row per distinct metric DEFINITION, not per
   * value — typically a handful per org), then the tiny per-definition sums are bucketed into
   * category totals here, in JS, over that handful of rows instead of every raw one. Produces the
   * exact same numbers as before: summing all rows in a category is the same whether you sum them
   * directly or sum-per-definition-then-add-the-per-definition-sums. */
  private async computeMetricTotals(campaignPlatformWhere: Prisma.Influencer2CampaignPlatformWhereInput) {
    const grouped = await this.prisma.influencer2MetricValue.groupBy({
      by: ["metricDefinitionId"],
      where: { isLatest: true, campaignPlatform: campaignPlatformWhere },
      _sum: { value: true },
    });

    let totalViews = 0, totalLikes = 0, totalComments = 0, totalShares = 0, totalEngagement = 0;
    let hasViews = false, hasLikes = false, hasComments = false, hasShares = false;
    if (grouped.length > 0) {
      const definitions = await this.prisma.influencer2MetricDefinition.findMany({
        where: { id: { in: grouped.map((g) => g.metricDefinitionId) } },
        select: { id: true, category: true, countsAsEngagement: true },
      });
      const defById = new Map(definitions.map((d) => [d.id, d]));
      for (const g of grouped) {
        const def = defById.get(g.metricDefinitionId);
        if (!def) continue;
        const value = Number(g._sum.value ?? 0);
        if (def.countsAsEngagement) totalEngagement += value;
        if (def.category === "VIEWS") { totalViews += value; hasViews = true; }
        else if (def.category === "LIKES") { totalLikes += value; hasLikes = true; }
        else if (def.category === "COMMENTS") { totalComments += value; hasComments = true; }
        else if (def.category === "SHARES") { totalShares += value; hasShares = true; }
      }
    }

    return {
      totalViews: hasViews ? totalViews : null,
      totalLikes: hasLikes ? totalLikes : null,
      totalComments: hasComments ? totalComments : null,
      totalShares: hasShares ? totalShares : null,
      totalEngagement,
    };
  }

  /** Aggregate stats for one influencer, one media host, or — via `scope` —
   * EVERY media host or EVERY influencer in the org at once (the collective
   * "Media Engagement"/"Influencers" dashboard views). Computed via
   * aggregation queries rather than loading every campaign into memory, so
   * it stays cheap regardless of history size. Pass exactly one of
   * influencerId/mediaHostId/scope. */
  async summary(organizationId: string, filter: { influencerId?: string; mediaHostId?: string; scope?: "ALL_MEDIA_HOSTS" | "ALL_INFLUENCERS"; from?: Date; to?: Date }) {
    const beneficiary = filter.influencerId
      ? { influencerId: filter.influencerId }
      : filter.mediaHostId
        ? { mediaHostId: filter.mediaHostId }
        : filter.scope === "ALL_MEDIA_HOSTS"
          ? { mediaHostId: { not: null } }
          : filter.scope === "ALL_INFLUENCERS"
            ? { influencerId: { not: null } }
            : {};

    // A "weekly report" means "what was published this week" — see publishedDateFilter. With a
    // range, the campaign set narrows to posts published in it; metrics are always each post's
    // CURRENT (isLatest) numbers, i.e. "here's what we know now about what went up this week," not
    // "numbers that happened to be typed in during this window" (collectedAt), which is a
    // different, less useful question and was silently hiding real posts/engagement whenever data
    // entry lagged behind the actual publish date.
    const hasRange = Boolean(filter.from && filter.to);
    const publishedFilter = hasRange ? this.publishedDateFilter(filter.from!, filter.to!) : {};
    const campaignWhere: Prisma.Influencer2CampaignWhereInput = { organizationId, ...beneficiary, ...publishedFilter };

    // "Post" means one piece of content (one Influencer2Campaign row) — the same thing the
    // Media/Influencer list pages' "Posts" column and the Media-by-type/report-details table
    // count. A post cross-posted to 2 platforms is still one post, not two: counting
    // Influencer2CampaignPlatform rows here instead (as this used to) silently inflated the total
    // for anything with more than one platform, disagreeing with every other "Posts" figure in the
    // app for the exact same data.
    const [campaignCount, totals, beneficiaryRows] = await Promise.all([
      this.prisma.influencer2Campaign.count({ where: campaignWhere }),
      this.computeMetricTotals({
        campaign: { organizationId, ...beneficiary },
        ...(hasRange ? this.publishedPlatformFilter(filter.from!, filter.to!) : {}),
      }),
      filter.scope
        ? this.prisma.influencer2Campaign.findMany({
            where: campaignWhere,
            select: { influencerId: true, mediaHostId: true },
            distinct: filter.scope === "ALL_MEDIA_HOSTS" ? ["mediaHostId"] : ["influencerId"],
          })
        : Promise.resolve(null),
    ]);

    return {
      totalCampaigns: campaignCount,
      totalPosts: campaignCount,
      totalBeneficiaries: beneficiaryRows?.length ?? null,
      ...totals,
      engagementPerPost: campaignCount > 0 ? Math.round((totals.totalEngagement / campaignCount) * 100) / 100 : null,
    };
  }

  /** One posting-agreement week's totals — the posts that actually count toward it (see
   * weekMatchFilter), using each post's current (isLatest) metrics rather than a collectedAt
   * window, since a week is evaluated as "what do we know now about the posts tagged to it," not
   * "what was recorded during that calendar week." */
  async weeklyAssessment(organizationId: string, filter: { mediaHostId?: string; influencerId?: string; weekNumber: number; weekStart: Date; weekEnd: Date }) {
    const beneficiary = filter.mediaHostId ? { mediaHostId: filter.mediaHostId } : { influencerId: filter.influencerId };
    const campaignWhere: Prisma.Influencer2CampaignWhereInput = {
      organizationId,
      ...beneficiary,
      ...this.weekMatchFilter(filter.weekNumber, filter.weekStart, filter.weekEnd),
    };

    // Same "one post = one Influencer2Campaign row, not one per platform" rule as summary() —
    // otherwise a single post cross-posted to 2 platforms would count double toward a weekly
    // posts-per-week target, and its reach would look like it came from twice as many posts.
    const [postCount, totals] = await Promise.all([
      this.prisma.influencer2Campaign.count({ where: campaignWhere }),
      this.computeMetricTotals({ campaign: campaignWhere }),
    ]);

    return { totalPosts: postCount, ...totals };
  }

  /** One folder's ("campaign") totals — same shape and same "current metrics, not a collectedAt
   * window" reasoning as weeklyAssessment(), just matched by folderMatchFilter instead of a
   * computed week window. This is what a PostingAgreement's target is checked against once a
   * folder (rather than an auto-computed week) is what's being evaluated. */
  async folderAssessment(organizationId: string, filter: { mediaHostId?: string; influencerId?: string; folderId: string; startDate: Date | null; endDate: Date | null }) {
    const beneficiary = filter.mediaHostId ? { mediaHostId: filter.mediaHostId } : { influencerId: filter.influencerId };
    const campaignWhere: Prisma.Influencer2CampaignWhereInput = {
      organizationId,
      ...beneficiary,
      ...this.folderMatchFilter(filter.folderId, filter.startDate, filter.endDate),
    };

    const [postCount, totals] = await Promise.all([
      this.prisma.influencer2Campaign.count({ where: campaignWhere }),
      this.computeMetricTotals({ campaign: campaignWhere }),
    ]);

    return { totalPosts: postCount, ...totals };
  }

  /** One org-wide week definition's totals for ONE beneficiary — same shape and same "current
   * metrics, not a collectedAt window" reasoning as folderAssessment(), just matched by plain
   * published-date range (publishedDateFilter) since a centralized week has no per-post tagging of
   * its own, only a shared date window every beneficiary is measured against. */
  async weekDefinitionAssessment(organizationId: string, filter: { mediaHostId?: string; influencerId?: string; startDate: Date; endDate: Date }) {
    const beneficiary = filter.mediaHostId ? { mediaHostId: filter.mediaHostId } : { influencerId: filter.influencerId };
    const campaignWhere: Prisma.Influencer2CampaignWhereInput = {
      organizationId,
      ...beneficiary,
      ...this.publishedDateFilter(filter.startDate, filter.endDate),
    };

    const [postCount, totals] = await Promise.all([
      this.prisma.influencer2Campaign.count({ where: campaignWhere }),
      this.computeMetricTotals({ campaign: campaignWhere }),
    ]);

    return { totalPosts: postCount, ...totals };
  }

  /**
   * The "what's actually behind that number" drill-down for the collective dashboards — every
   * campaign that fed into summary()'s counts for this scope/range, plus the same set broken down
   * by platform (the "3 Instagram, 4 TikTok" view) and, for media hosts, by media type. influencerId/
   * mediaHostId aren't real foreign keys (see the field comment on Influencer2Campaign), so
   * beneficiary names are resolved with a separate batch lookup rather than a Prisma include.
   */
  // The one current caller (MediaEngagementOverview) only ever reads byMediaType — campaigns/
  // byPlatform aren't rendered anywhere today — but they stay part of the response for whatever
  // drill-down eventually wants them, just bounded: for "All time"/a wide custom range at org-wide
  // scope, fetching every single post+platform ever recorded (unbounded, no take/skip) was the
  // single biggest cost on this endpoint. byMediaType/byPlatform below are computed via DB-side
  // groupBy instead — bounded by the number of distinct media hosts/platforms in the org, not by
  // how many posts exist, so they stay fast and fully accurate regardless of range size.
  private static readonly REPORT_DETAILS_CAMPAIGN_LIMIT = 200;

  async reportDetails(organizationId: string, filter: { scope: "ALL_MEDIA_HOSTS" | "ALL_INFLUENCERS"; from?: Date; to?: Date }) {
    const beneficiary = filter.scope === "ALL_MEDIA_HOSTS" ? { mediaHostId: { not: null } } : { influencerId: { not: null } };
    const rangeFilter = filter.from && filter.to ? this.publishedDateFilter(filter.from, filter.to) : {};
    const campaignWhere: Prisma.Influencer2CampaignWhereInput = { organizationId, ...beneficiary, ...rangeFilter };

    const [campaigns, mediaTypeGroups, platformGroups] = await Promise.all([
      this.prisma.influencer2Campaign.findMany({
        where: campaignWhere,
        select: {
          id: true,
          name: true,
          contentType: true,
          status: true,
          createdAt: true,
          influencerId: true,
          mediaHostId: true,
          platforms: { select: { platform: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: Influencer2CampaignsService.REPORT_DETAILS_CAMPAIGN_LIMIT,
      }),
      filter.scope === "ALL_MEDIA_HOSTS"
        ? this.prisma.influencer2Campaign.groupBy({ by: ["mediaHostId"], where: campaignWhere, _count: true })
        : Promise.resolve([]),
      this.prisma.influencer2CampaignPlatform.groupBy({ by: ["platformId"], where: { campaign: campaignWhere }, _count: true }),
    ]);

    const influencerIds = Array.from(new Set(campaigns.map((c) => c.influencerId).filter((id): id is string => Boolean(id))));
    const mediaHostIds = Array.from(new Set([...campaigns.map((c) => c.mediaHostId), ...mediaTypeGroups.map((g) => g.mediaHostId)].filter((id): id is string => Boolean(id))));
    const platformIds = platformGroups.map((g) => g.platformId);
    const [influencers, mediaHosts, platforms]: [Array<{ id: string; name: string }>, Array<{ id: string; name: string; type: string }>, Array<{ id: string; name: string }>] = await Promise.all([
      influencerIds.length ? this.prisma.influencer.findMany({ where: { id: { in: influencerIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      mediaHostIds.length ? this.prisma.mediaHost.findMany({ where: { id: { in: mediaHostIds } }, select: { id: true, name: true, type: true } }) : Promise.resolve([]),
      platformIds.length ? this.prisma.influencer2Platform.findMany({ where: { id: { in: platformIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    ]);
    const influencerById = new Map(influencers.map((i) => [i.id, i.name]));
    const hostById = new Map(mediaHosts.map((h) => [h.id, h]));
    const platformNameById = new Map(platforms.map((p) => [p.id, p.name]));

    const rows = campaigns.map((c) => {
      const host = c.mediaHostId ? hostById.get(c.mediaHostId) : undefined;
      return {
        id: c.id,
        name: c.name,
        contentType: c.contentType,
        status: c.status,
        createdAt: c.createdAt,
        beneficiaryName: c.influencerId ? (influencerById.get(c.influencerId) ?? "—") : (host?.name ?? "—"),
        mediaType: host?.type ?? null,
        platforms: c.platforms.map((p) => p.platform.name),
      };
    });

    const byMediaType = new Map<string, number>();
    for (const g of mediaTypeGroups) {
      const host = g.mediaHostId ? hostById.get(g.mediaHostId) : undefined;
      // mediaHostId isn't a real foreign key (see the field comment on Influencer2Campaign), so a
      // campaign can outlive the host it pointed to. Bucket those under UNKNOWN instead of silently
      // dropping them — otherwise byMediaType's total quietly falls short of summary()'s
      // totalCampaigns for the same scope/range, which reads as a bug, not a deleted host.
      const key = host ? host.type : "UNKNOWN";
      byMediaType.set(key, (byMediaType.get(key) ?? 0) + g._count);
    }
    const byPlatform = new Map<string, number>();
    for (const g of platformGroups) {
      const name = platformNameById.get(g.platformId) ?? "—";
      byPlatform.set(name, (byPlatform.get(name) ?? 0) + g._count);
    }

    return {
      campaigns: rows,
      byPlatform: Array.from(byPlatform.entries()).map(([platform, count]) => ({ platform, count })).sort((a, b) => b.count - a.count),
      byMediaType: Array.from(byMediaType.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    };
  }

  async addPlatform(organizationId: string, campaignId: string, dto: AddCampaignPlatformDto) {
    await this.ensure(organizationId, campaignId);
    const platform = await this.prisma.influencer2Platform.findUnique({ where: { id: dto.platformId } });
    if (!platform) throw new NotFoundException("Platform not found");

    try {
      return await this.prisma.influencer2CampaignPlatform.create({
        data: {
          campaignId,
          platformId: dto.platformId,
          postUrl: dto.postUrl,
          postId: dto.postId,
          publishedAt: dateOrUndefined(dto.publishedAt),
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new BadRequestException("This platform has already been added to this campaign");
      }
      throw err;
    }
  }

  async updatePlatform(organizationId: string, campaignId: string, campaignPlatformId: string, dto: UpdateCampaignPlatformDto) {
    await this.ensureCampaignPlatform(organizationId, campaignId, campaignPlatformId);
    return this.prisma.influencer2CampaignPlatform.update({
      where: { id: campaignPlatformId },
      data: { ...dto, publishedAt: dto.publishedAt !== undefined ? dateOrUndefined(dto.publishedAt) : undefined },
    });
  }

  async removePlatform(organizationId: string, campaignId: string, campaignPlatformId: string) {
    await this.ensureCampaignPlatform(organizationId, campaignId, campaignPlatformId);
    await this.prisma.influencer2CampaignPlatform.delete({ where: { id: campaignPlatformId } });
    return { success: true };
  }

  /** Every metric update is an INSERT, never an overwrite — history stays
   * fully queryable while "current" reads stay a plain isLatest:true filter. */
  async submitMetrics(organizationId: string, campaignId: string, campaignPlatformId: string, dto: SubmitMetricsDto, collectedBy?: string) {
    await this.ensureCampaignPlatform(organizationId, campaignId, campaignPlatformId);

    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.metrics) {
        const definition = await tx.influencer2MetricDefinition.findUnique({ where: { id: entry.metricDefinitionId } });
        if (!definition) throw new NotFoundException(`Unknown metric: ${entry.metricDefinitionId}`);

        await tx.influencer2MetricValue.updateMany({
          where: { campaignPlatformId, metricDefinitionId: entry.metricDefinitionId, isLatest: true },
          data: { isLatest: false },
        });
        await tx.influencer2MetricValue.create({
          data: {
            campaignPlatformId,
            metricDefinitionId: entry.metricDefinitionId,
            value: entry.value,
            source: definition.category === "SENTIMENT" ? "ESTIMATED" : "MANUAL_ENTRY",
            collectedBy,
          },
        });
      }
    });

    const cp = await this.prisma.influencer2CampaignPlatform.findUniqueOrThrow({
      where: { id: campaignPlatformId },
      include: { platform: true, metrics: { where: { isLatest: true }, include: { metricDefinition: true } } },
    });
    return this.summarizePlatform(cp);
  }

  async metricHistory(organizationId: string, campaignId: string, campaignPlatformId: string, metricKey: string) {
    await this.ensureCampaignPlatform(organizationId, campaignId, campaignPlatformId);
    const rows = await this.prisma.influencer2MetricValue.findMany({
      where: { campaignPlatformId, metricDefinition: { key: metricKey } },
      orderBy: { collectedAt: "asc" },
    });
    return rows.map((r) => ({ collectedAt: r.collectedAt, value: Number(r.value) }));
  }
}
