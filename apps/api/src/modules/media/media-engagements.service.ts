import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type MediaEngagement, type MediaEngagementStatus } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMediaEngagementDto } from "./dto/create-media-engagement.dto";
import { UpdateMediaEngagementDto } from "./dto/update-media-engagement.dto";

/** rateTzs/totalTzs are Prisma Decimal — serialize to JSON strings unless converted here, which
 * would silently break any frontend sum/arithmetic over them (string concatenation instead of
 * addition). Convert once, at the source, for every response this service returns. */
function toNumeric(e: MediaEngagement) {
  return { ...e, rateTzs: e.rateTzs != null ? Number(e.rateTzs) : null, totalTzs: e.totalTzs != null ? Number(e.totalTzs) : null };
}

@Injectable()
export class MediaEngagementsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForHost(organizationId: string, mediaHostId: string, status?: MediaEngagementStatus) {
    const host = await this.prisma.mediaHost.findFirst({ where: { id: mediaHostId, organizationId } });
    if (!host) throw new NotFoundException("Media host not found");
    const rows = await this.prisma.mediaEngagement.findMany({ where: { mediaHostId, status }, orderBy: { createdAt: "desc" } });
    return rows.map(toNumeric);
  }

  /** Paginated variant for the dedicated "all campaigns" page — a media host or influencer can
   * accumulate a very large number of campaigns over time, so that page never loads them all at
   * once the way the small unpaid-campaigns picker (listForHost/listForInfluencer above) does. */
  async listForHostPaginated(organizationId: string, mediaHostId: string, page: number, pageSize: number) {
    const host = await this.prisma.mediaHost.findFirst({ where: { id: mediaHostId, organizationId } });
    if (!host) throw new NotFoundException("Media host not found");
    const [items, total] = await Promise.all([
      this.prisma.mediaEngagement.findMany({ where: { mediaHostId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.mediaEngagement.count({ where: { mediaHostId } }),
    ]);
    return { items: items.map(toNumeric), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async createForHost(organizationId: string, mediaHostId: string, dto: CreateMediaEngagementDto) {
    const host = await this.prisma.mediaHost.findFirst({ where: { id: mediaHostId, organizationId } });
    if (!host) throw new NotFoundException("Media host not found");
    const row = await this.prisma.mediaEngagement.create({ data: { organizationId, mediaHostId, ...dto } });
    await this.logReach(row.id, row.likes, row.comments);
    return toNumeric(row);
  }

  async listForInfluencer(organizationId: string, influencerId: string, status?: MediaEngagementStatus) {
    const influencer = await this.prisma.influencer.findFirst({ where: { id: influencerId, organizationId } });
    if (!influencer) throw new NotFoundException("Influencer not found");
    const rows = await this.prisma.mediaEngagement.findMany({ where: { influencerId, status }, orderBy: { createdAt: "desc" } });
    return rows.map(toNumeric);
  }

  async listForInfluencerPaginated(organizationId: string, influencerId: string, page: number, pageSize: number) {
    const influencer = await this.prisma.influencer.findFirst({ where: { id: influencerId, organizationId } });
    if (!influencer) throw new NotFoundException("Influencer not found");
    const [items, total] = await Promise.all([
      this.prisma.mediaEngagement.findMany({ where: { influencerId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.mediaEngagement.count({ where: { influencerId } }),
    ]);
    return { items: items.map(toNumeric), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async createForInfluencer(organizationId: string, influencerId: string, dto: CreateMediaEngagementDto) {
    const influencer = await this.prisma.influencer.findFirst({ where: { id: influencerId, organizationId } });
    if (!influencer) throw new NotFoundException("Influencer not found");
    const row = await this.prisma.mediaEngagement.create({ data: { organizationId, influencerId, ...dto } });
    await this.logReach(row.id, row.likes, row.comments);
    return toNumeric(row);
  }

  private async ensure(organizationId: string, id: string) {
    const engagement = await this.prisma.mediaEngagement.findFirst({ where: { id, organizationId } });
    if (!engagement) throw new NotFoundException("Campaign not found");
    return engagement;
  }

  // Editable here: narrative/content fields + likes/comments only — CreateMediaEngagementDto
  // never includes rateTzs/totalTzs/engagement/engagementDates/status, those are only ever set by
  // PaymentsService.create() in its own transaction. So this stays safe to allow even once PAID —
  // e.g. recording likes/comments after a post has gone live and already been paid for.
  async update(organizationId: string, id: string, dto: UpdateMediaEngagementDto) {
    await this.ensure(organizationId, id);
    const row = await this.prisma.mediaEngagement.update({ where: { id }, data: dto });
    if (dto.likes !== undefined || dto.comments !== undefined) {
      await this.logReach(row.id, row.likes, row.comments);
    }
    return toNumeric(row);
  }

  /** One timestamped snapshot per likes/comments change — the raw material reachMilestones()
   * reconstructs "reach as of 1 week/1 month/..." from, since we don't know in advance which
   * moments in a campaign's life will matter later. */
  private async logReach(mediaEngagementId: string, likes: number | null, comments: number | null) {
    await this.prisma.mediaEngagementReachLog.create({
      data: { mediaEngagementId, likes: likes ?? 0, comments: comments ?? 0 },
    });
  }

  /** For each fixed milestone after the campaign's creation date, the reach recorded as of that
   * date — or "not reached yet" if the milestone is still in the future. Uses the latest log
   * snapshot at or before the milestone date, so it reflects what was actually known then. */
  async reachMilestones(organizationId: string, id: string) {
    const engagement = await this.ensure(organizationId, id);
    const logs = await this.prisma.mediaEngagementReachLog.findMany({
      where: { mediaEngagementId: id },
      orderBy: { recordedAt: "asc" },
    });
    const now = new Date();
    const milestones: Array<{ key: string; days: number }> = [
      { key: "week1", days: 7 },
      { key: "month1", days: 30 },
      { key: "month3", days: 90 },
      { key: "year1", days: 365 },
    ];
    return milestones.map(({ key, days }) => {
      const dueAt = new Date(engagement.createdAt.getTime() + days * 86_400_000);
      if (now < dueAt) return { key, dueAt: dueAt.toISOString(), reached: false, value: null as number | null };
      let asOf: (typeof logs)[number] | null = null;
      for (const log of logs) {
        if (log.recordedAt <= dueAt) asOf = log;
        else break;
      }
      return { key, dueAt: dueAt.toISOString(), reached: true, value: asOf ? asOf.likes + asOf.comments : null };
    });
  }

  async delete(organizationId: string, id: string) {
    const engagement = await this.ensure(organizationId, id);
    if (engagement.status === "PAID") throw new ForbiddenException("This campaign has already been paid and can no longer be deleted");
    await this.prisma.mediaEngagement.delete({ where: { id } });
    return { success: true };
  }

  /** Content pieces (campaigns) posted per calendar week, for one host or influencer — same
   * MySQL week-bucketing idiom as AnalyticsService.membershipGrowth, since MySQL has no
   * date_trunc(). Buckets by createdAt (engagementDates is free text, not a real date). */
  async contentPerWeek(organizationId: string, filter: { mediaHostId: string } | { influencerId: string }) {
    if ("mediaHostId" in filter) {
      const host = await this.prisma.mediaHost.findFirst({ where: { id: filter.mediaHostId, organizationId } });
      if (!host) throw new NotFoundException("Media host not found");
    } else {
      const influencer = await this.prisma.influencer.findFirst({ where: { id: filter.influencerId, organizationId } });
      if (!influencer) throw new NotFoundException("Influencer not found");
    }
    const condition = "mediaHostId" in filter ? Prisma.sql`media_host_id = ${filter.mediaHostId}` : Prisma.sql`influencer_id = ${filter.influencerId}`;

    const rows = await this.prisma.$queryRaw<Array<{ period: string; count: bigint }>>(Prisma.sql`
      select DATE_FORMAT(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY), '%Y-%m-%d 00:00:00') as period, count(*) as count
      from media_engagements
      where organization_id = ${organizationId} and ${condition}
      group by period
      order by period asc
    `);
    return rows.map((r) => ({ period: new Date(r.period).toISOString(), count: Number(r.count) }));
  }
}
