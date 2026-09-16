import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Influencer2CampaignStatus, Influencer2ContentType, Influencer2MetricCategory, Prisma } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateInfluencer2CampaignDto } from "./dto/create-influencer2-campaign.dto";
import { UpdateInfluencer2CampaignDto } from "./dto/update-influencer2-campaign.dto";
import { AddCampaignPlatformDto } from "./dto/add-campaign-platform.dto";
import { UpdateCampaignPlatformDto } from "./dto/update-campaign-platform.dto";
import { SubmitMetricsDto } from "./dto/submit-metrics.dto";
import { latestPerCampaignPlatformMetric } from "../../common/metric-window.util";

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
    },
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.Influencer2CampaignWhereInput = { organizationId };
    if (filters.influencerId) where.influencerId = filters.influencerId;
    if (filters.mediaHostId) where.mediaHostId = filters.mediaHostId;
    if (filters.contentType) where.contentType = filters.contentType;
    if (filters.status) where.status = filters.status;
    if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters.platformKey) where.platforms = { some: { platform: { key: filters.platformKey } } };
    if (filters.weekNumber != null && filters.from && filters.to) Object.assign(where, this.weekMatchFilter(filters.weekNumber, filters.from, filters.to));
    else if (filters.from && filters.to) where.createdAt = { gte: filters.from, lte: filters.to };

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

    const [influencerNameById, mediaHostNameById, approvedPayments] = await Promise.all([
      this.resolveInfluencerNames(organizationId, rows.map((r) => r.influencerId)),
      this.resolveMediaHostNames(organizationId, rows.map((r) => r.mediaHostId)),
      this.prisma.payment.findMany({
        where: { influencer2CampaignId: { in: rows.map((r) => r.id) }, status: "PROCESSING" },
        select: { influencer2CampaignId: true },
      }),
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
          paymentProgress: this.paymentProgress(campaign.paymentStatus, approvedCampaignIds.has(campaign.id)),
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
    const approvedPayment = await this.prisma.payment.findFirst({ where: { influencer2CampaignId: id, status: "PROCESSING" }, select: { id: true } });

    return {
      campaign: {
        ...toNumericCampaign(campaign),
        paymentProgress: this.paymentProgress(campaign.paymentStatus, Boolean(approvedPayment)),
      },
      influencer,
      mediaHost,
      platforms,
      totals: this.aggregateTotals(platforms),
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

    // A metric value is an append-only snapshot, not a per-period delta — there's nothing to sum
    // "for this week" beyond the figures that were actually recorded during it. With a range, skip
    // the all-time isLatest flag and instead take the latest snapshot collected inside the window
    // per (campaignPlatform, metricDefinition) — see metric-window.util.ts.
    const hasRange = Boolean(filter.from && filter.to);
    const rangeFilter = hasRange ? { gte: filter.from, lte: filter.to } : undefined;

    const [campaignCount, postCount, rawValues, beneficiaryRows] = await Promise.all([
      this.prisma.influencer2Campaign.count({ where: { organizationId, ...beneficiary, ...(rangeFilter ? { createdAt: rangeFilter } : {}) } }),
      this.prisma.influencer2CampaignPlatform.count({ where: { campaign: { organizationId, ...beneficiary }, ...(rangeFilter ? { createdAt: rangeFilter } : {}) } }),
      hasRange
        ? this.prisma.influencer2MetricValue.findMany({
            where: { collectedAt: rangeFilter, campaignPlatform: { campaign: { organizationId, ...beneficiary } } },
            include: { metricDefinition: true },
            orderBy: { collectedAt: "desc" },
          })
        : this.prisma.influencer2MetricValue.findMany({
            where: { isLatest: true, campaignPlatform: { campaign: { organizationId, ...beneficiary } } },
            include: { metricDefinition: true },
          }),
      filter.scope
        ? this.prisma.influencer2Campaign.findMany({
            where: { organizationId, ...beneficiary, ...(rangeFilter ? { createdAt: rangeFilter } : {}) },
            select: { influencerId: true, mediaHostId: true },
            distinct: filter.scope === "ALL_MEDIA_HOSTS" ? ["mediaHostId"] : ["influencerId"],
          })
        : Promise.resolve(null),
    ]);
    const values = hasRange ? latestPerCampaignPlatformMetric(rawValues) : rawValues;

    let totalViews = 0, totalLikes = 0, totalComments = 0, totalShares = 0, totalEngagement = 0;
    let hasViews = false, hasLikes = false, hasComments = false, hasShares = false;
    for (const v of values) {
      const value = Number(v.value);
      if (v.metricDefinition.countsAsEngagement) totalEngagement += value;
      if (v.metricDefinition.category === "VIEWS") { totalViews += value; hasViews = true; }
      else if (v.metricDefinition.category === "LIKES") { totalLikes += value; hasLikes = true; }
      else if (v.metricDefinition.category === "COMMENTS") { totalComments += value; hasComments = true; }
      else if (v.metricDefinition.category === "SHARES") { totalShares += value; hasShares = true; }
    }

    return {
      totalCampaigns: campaignCount,
      totalPosts: postCount,
      totalBeneficiaries: beneficiaryRows?.length ?? null,
      totalViews: hasViews ? totalViews : null,
      totalLikes: hasLikes ? totalLikes : null,
      totalComments: hasComments ? totalComments : null,
      totalShares: hasShares ? totalShares : null,
      totalEngagement,
      engagementPerPost: postCount > 0 ? Math.round((totalEngagement / postCount) * 100) / 100 : null,
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

    const [postCount, values] = await Promise.all([
      this.prisma.influencer2CampaignPlatform.count({ where: { campaign: campaignWhere } }),
      this.prisma.influencer2MetricValue.findMany({
        where: { isLatest: true, campaignPlatform: { campaign: campaignWhere } },
        include: { metricDefinition: true },
      }),
    ]);

    let totalViews = 0, totalLikes = 0, totalComments = 0, totalShares = 0, totalEngagement = 0;
    let hasViews = false, hasLikes = false, hasComments = false, hasShares = false;
    for (const v of values) {
      const value = Number(v.value);
      if (v.metricDefinition.countsAsEngagement) totalEngagement += value;
      if (v.metricDefinition.category === "VIEWS") { totalViews += value; hasViews = true; }
      else if (v.metricDefinition.category === "LIKES") { totalLikes += value; hasLikes = true; }
      else if (v.metricDefinition.category === "COMMENTS") { totalComments += value; hasComments = true; }
      else if (v.metricDefinition.category === "SHARES") { totalShares += value; hasShares = true; }
    }

    return {
      totalPosts: postCount,
      totalViews: hasViews ? totalViews : null,
      totalLikes: hasLikes ? totalLikes : null,
      totalComments: hasComments ? totalComments : null,
      totalShares: hasShares ? totalShares : null,
      totalEngagement,
    };
  }

  /**
   * The "what's actually behind that number" drill-down for the collective dashboards — every
   * campaign that fed into summary()'s counts for this scope/range, plus the same set broken down
   * by platform (the "3 Instagram, 4 TikTok" view) and, for media hosts, by media type. influencerId/
   * mediaHostId aren't real foreign keys (see the field comment on Influencer2Campaign), so
   * beneficiary names are resolved with a separate batch lookup rather than a Prisma include.
   */
  async reportDetails(organizationId: string, filter: { scope: "ALL_MEDIA_HOSTS" | "ALL_INFLUENCERS"; from?: Date; to?: Date }) {
    const beneficiary = filter.scope === "ALL_MEDIA_HOSTS" ? { mediaHostId: { not: null } } : { influencerId: { not: null } };
    const rangeFilter = filter.from && filter.to ? { createdAt: { gte: filter.from, lte: filter.to } } : {};

    const campaigns = await this.prisma.influencer2Campaign.findMany({
      where: { organizationId, ...beneficiary, ...rangeFilter },
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
    });

    const influencerIds = Array.from(new Set(campaigns.map((c) => c.influencerId).filter((id): id is string => Boolean(id))));
    const mediaHostIds = Array.from(new Set(campaigns.map((c) => c.mediaHostId).filter((id): id is string => Boolean(id))));
    const [influencers, mediaHosts]: [Array<{ id: string; name: string }>, Array<{ id: string; name: string; type: string }>] = await Promise.all([
      influencerIds.length ? this.prisma.influencer.findMany({ where: { id: { in: influencerIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      mediaHostIds.length ? this.prisma.mediaHost.findMany({ where: { id: { in: mediaHostIds } }, select: { id: true, name: true, type: true } }) : Promise.resolve([]),
    ]);
    const influencerById = new Map(influencers.map((i) => [i.id, i.name]));
    const hostById = new Map(mediaHosts.map((h) => [h.id, h]));

    const byPlatform = new Map<string, number>();
    const byMediaType = new Map<string, number>();
    const rows = campaigns.map((c) => {
      const platforms = c.platforms.map((p) => p.platform.name);
      for (const p of platforms) byPlatform.set(p, (byPlatform.get(p) ?? 0) + 1);
      const host = c.mediaHostId ? hostById.get(c.mediaHostId) : undefined;
      // mediaHostId/influencerId aren't real foreign keys, so a campaign can outlive the host it
      // pointed to (deleting a host doesn't touch its campaigns). Bucket those under UNKNOWN
      // instead of silently dropping them — otherwise byMediaType's total quietly falls short of
      // summary()'s totalCampaigns for the same scope/range, which reads as a bug, not a deleted host.
      if (host) byMediaType.set(host.type, (byMediaType.get(host.type) ?? 0) + 1);
      else if (c.mediaHostId) byMediaType.set("UNKNOWN", (byMediaType.get("UNKNOWN") ?? 0) + 1);
      return {
        id: c.id,
        name: c.name,
        contentType: c.contentType,
        status: c.status,
        createdAt: c.createdAt,
        beneficiaryName: c.influencerId ? (influencerById.get(c.influencerId) ?? "—") : (host?.name ?? "—"),
        mediaType: host?.type ?? null,
        platforms,
      };
    });

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
