import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type MetricTotals = { likes: number; comments: number; views: number; shares: number };

function zeroTotals(): MetricTotals {
  return { likes: 0, comments: 0, views: 0, shares: 0 };
}

function addTotals(a: MetricTotals, b: MetricTotals): MetricTotals {
  return { likes: a.likes + b.likes, comments: a.comments + b.comments, views: a.views + b.views, shares: a.shares + b.shares };
}

/** Real, registered-data-only stats for the Media Engagement dashboard — deliberately NOT
 * derived from the reference catalog (46 media houses in the JSON), only from actual MediaHost
 * rows the org has created and actual engagement recorded against them. "Active media" = distinct
 * MediaOutlet a real host is registered under (10 hosts under 1 outlet = 1 active media, 10 active
 * hosts), matching the client's own example exactly. */
@Injectable()
export class MediaEngagementOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(organizationId: string) {
    const hosts = await this.prisma.mediaHost.findMany({
      where: { organizationId },
      select: { id: true, name: true, type: true, mediaOutletId: true, mediaOutlet: { select: { id: true, name: true } } },
    });
    const perHost = new Map<string, MetricTotals>();
    function bump(hostId: string | null, field: keyof MetricTotals, amount: number) {
      if (!hostId || !amount) return;
      const current = perHost.get(hostId) ?? zeroTotals();
      current[field] += amount;
      perHost.set(hostId, current);
    }

    const [legacyHostEngagements, legacyInfluencerEngagements, i2HostValues, i2InfluencerValues] = await Promise.all([
      this.prisma.mediaEngagement.findMany({
        where: { organizationId, mediaHostId: { not: null } },
        select: { mediaHostId: true, likes: true, comments: true },
      }),
      this.prisma.mediaEngagement.aggregate({
        where: { organizationId, influencerId: { not: null } },
        _sum: { likes: true, comments: true },
      }),
      this.prisma.influencer2MetricValue.findMany({
        where: { isLatest: true, campaignPlatform: { campaign: { organizationId, mediaHostId: { not: null } } } },
        select: { value: true, metricDefinition: { select: { category: true } }, campaignPlatform: { select: { campaign: { select: { mediaHostId: true } } } } },
      }),
      this.prisma.influencer2MetricValue.findMany({
        where: { isLatest: true, campaignPlatform: { campaign: { organizationId, influencerId: { not: null } } } },
        select: { value: true, metricDefinition: { select: { category: true } } },
      }),
    ]);

    for (const e of legacyHostEngagements) {
      bump(e.mediaHostId, "likes", e.likes ?? 0);
      bump(e.mediaHostId, "comments", e.comments ?? 0);
    }
    const categoryField: Record<string, keyof MetricTotals | undefined> = { LIKES: "likes", COMMENTS: "comments", VIEWS: "views", SHARES: "shares" };
    for (const v of i2HostValues) {
      const field = categoryField[v.metricDefinition.category];
      const hostId = v.campaignPlatform.campaign.mediaHostId;
      if (field && hostId) bump(hostId, field, Number(v.value));
    }

    // Influencer reach doesn't need a per-host breakdown, just the four org-wide totals.
    const influencerReach = zeroTotals();
    influencerReach.likes += legacyInfluencerEngagements._sum.likes ?? 0;
    influencerReach.comments += legacyInfluencerEngagements._sum.comments ?? 0;
    for (const v of i2InfluencerValues) {
      const field = categoryField[v.metricDefinition.category];
      if (field) influencerReach[field] += Number(v.value);
    }

    // Every stat below counts only hosts actually registered through the Media/Channel/Session
    // flow (mediaOutletId set) — a host created the old way, before that flow existed, has
    // nothing meaningful to report here and must not inflate these numbers or its type's count.
    const registeredHosts = hosts.filter((h) => h.mediaOutletId);

    const activeHostCount = registeredHosts.length;
    const activeMediaCount = new Set(registeredHosts.map((h) => h.mediaOutletId)).size;

    const hostsByType = new Map<string, number>();
    const engagementByType = new Map<string, MetricTotals>();
    for (const h of registeredHosts) {
      hostsByType.set(h.type, (hostsByType.get(h.type) ?? 0) + 1);
      engagementByType.set(h.type, addTotals(engagementByType.get(h.type) ?? zeroTotals(), perHost.get(h.id) ?? zeroTotals()));
    }

    const topHosts = registeredHosts
      .map((h) => ({ id: h.id, name: h.name, type: h.type, ...(perHost.get(h.id) ?? zeroTotals()) }))
      .filter((h) => h.likes || h.comments || h.views || h.shares)
      .sort((a, b) => b.likes + b.comments + b.views + b.shares - (a.likes + a.comments + a.views + a.shares))
      .slice(0, 5);

    const byOutlet = new Map<string, { id: string; name: string } & MetricTotals>();
    for (const h of registeredHosts) {
      if (!h.mediaOutlet) continue;
      const current = byOutlet.get(h.mediaOutlet.id) ?? { id: h.mediaOutlet.id, name: h.mediaOutlet.name, ...zeroTotals() };
      const totals = addTotals(current, perHost.get(h.id) ?? zeroTotals());
      byOutlet.set(h.mediaOutlet.id, { id: current.id, name: current.name, ...totals });
    }
    const topMedia = Array.from(byOutlet.values())
      .filter((m) => m.likes || m.comments || m.views || m.shares)
      .sort((a, b) => b.likes + b.comments + b.views + b.shares - (a.likes + a.comments + a.views + a.shares))
      .slice(0, 5);

    const mediaReach = registeredHosts.map((h) => perHost.get(h.id) ?? zeroTotals()).reduce(addTotals, zeroTotals());

    return {
      activeMediaCount,
      activeHostCount,
      hostsByType: Array.from(hostsByType.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      engagementByType: Array.from(engagementByType.entries()).map(([type, totals]) => ({ type, ...totals })),
      topHosts,
      topMedia,
      mediaReach,
      influencerReach,
    };
  }
}
