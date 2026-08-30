import { Injectable } from "@nestjs/common";
import { Prisma } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";

type Interval = "day" | "week" | "month" | "quarter" | "year";

/**
 * MySQL/MariaDB has no date_trunc() (that's Postgres-only) — build the
 * equivalent bucketing expression per interval. `interval` must come from a
 * fixed TS union, never raw user input, since it's spliced into SQL syntax
 * rather than bound as a parameter.
 */
function truncateRegistrationDate(interval: Interval): Prisma.Sql {
  switch (interval) {
    case "day":
      return Prisma.sql`DATE_FORMAT(registration_date, '%Y-%m-%d 00:00:00')`;
    case "week":
      return Prisma.sql`DATE_FORMAT(DATE_SUB(registration_date, INTERVAL WEEKDAY(registration_date) DAY), '%Y-%m-%d 00:00:00')`;
    case "quarter":
      return Prisma.sql`CONCAT(YEAR(registration_date), '-', LPAD((QUARTER(registration_date) - 1) * 3 + 1, 2, '0'), '-01 00:00:00')`;
    case "year":
      return Prisma.sql`DATE_FORMAT(registration_date, '%Y-01-01 00:00:00')`;
    case "month":
    default:
      return Prisma.sql`DATE_FORMAT(registration_date, '%Y-%m-01 00:00:00')`;
  }
}

function truncateCheckedInAt(granularity: "hour" | "day"): Prisma.Sql {
  return granularity === "hour"
    ? Prisma.sql`DATE_FORMAT(checked_in_at, '%Y-%m-%d %H:00:00')`
    : Prisma.sql`DATE_FORMAT(checked_in_at, '%Y-%m-%d 00:00:00')`;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async membershipGrowth(organizationId: string, interval: Interval = "month", from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 1));
    const toDate = to ? new Date(to) : new Date();
    const bucket = truncateRegistrationDate(interval);

    const rows = await this.prisma.$queryRaw<Array<{ period: string; new_members: bigint }>>(Prisma.sql`
      select ${bucket} as period, count(*) as new_members
      from members
      where organization_id = ${organizationId}
        and registration_date between ${fromDate} and ${toDate}
      group by period
      order by period asc
    `);

    let cumulative = await this.prisma.member.count({ where: { organizationId, registrationDate: { lt: fromDate } } });
    return rows.map((r) => {
      cumulative += Number(r.new_members);
      return { period: new Date(r.period).toISOString(), newMembers: Number(r.new_members), cumulativeMembers: cumulative };
    });
  }

  async membershipSummary(organizationId: string) {
    const [total, active, inactive, org] = await Promise.all([
      this.prisma.member.count({ where: { organizationId } }),
      this.prisma.member.count({ where: { organizationId, membershipStatus: "ACTIVE" } }),
      this.prisma.member.count({ where: { organizationId, membershipStatus: { in: ["INACTIVE", "SUSPENDED", "EXPIRED"] } } }),
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { memberTarget: true } }),
    ]);
    return { total, active, inactive, target: org?.memberTarget ?? null };
  }

  async membersByRegion(organizationId: string) {
    const rows = await this.prisma.member.groupBy({
      by: ["region"],
      where: { organizationId },
      _count: { _all: true },
      orderBy: { _count: { region: "desc" } },
    });
    return rows.map((r) => ({ region: r.region ?? "Unknown", count: r._count._all }));
  }

  async leadersByRegion(organizationId: string) {
    const rows = await this.prisma.member.groupBy({
      by: ["region"],
      where: { organizationId, isLeader: true },
      _count: { _all: true },
      orderBy: { _count: { region: "desc" } },
    });
    return rows.map((r) => ({ region: r.region ?? "Unknown", count: r._count._all }));
  }

  /** Org-wide reach (likes+comments) summed across EVERY media-host and influencer engagement —
   * distinct from the per-person reach gauge, which only sums one host's/influencer's own
   * engagements. Split by source so the Dashboard can show a media-vs-influencer breakdown.
   * Also folds in Influencer 2 campaigns (likes+comments, same definition as the legacy figure)
   * since influencers — and now media hosts — record their engagement there instead. */
  async mediaReachSummary(organizationId: string) {
    const [mediaAgg, influencerAgg, org, i2MediaAgg, i2InfluencerAgg] = await Promise.all([
      this.prisma.mediaEngagement.aggregate({
        where: { organizationId, mediaHostId: { not: null } },
        _sum: { likes: true, comments: true },
      }),
      this.prisma.mediaEngagement.aggregate({
        where: { organizationId, influencerId: { not: null } },
        _sum: { likes: true, comments: true },
      }),
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { mediaReachTarget: true } }),
      this.prisma.influencer2MetricValue.aggregate({
        where: { isLatest: true, metricDefinition: { category: { in: ["LIKES", "COMMENTS"] } }, campaignPlatform: { campaign: { organizationId, mediaHostId: { not: null } } } },
        _sum: { value: true },
      }),
      this.prisma.influencer2MetricValue.aggregate({
        where: { isLatest: true, metricDefinition: { category: { in: ["LIKES", "COMMENTS"] } }, campaignPlatform: { campaign: { organizationId, influencerId: { not: null } } } },
        _sum: { value: true },
      }),
    ]);
    const mediaReach = (mediaAgg._sum.likes ?? 0) + (mediaAgg._sum.comments ?? 0) + Number(i2MediaAgg._sum.value ?? 0);
    const influencerReach = (influencerAgg._sum.likes ?? 0) + (influencerAgg._sum.comments ?? 0) + Number(i2InfluencerAgg._sum.value ?? 0);
    return { totalReach: mediaReach + influencerReach, mediaReach, influencerReach, target: org?.mediaReachTarget ?? null };
  }

  private direction(current: number, target: number | null): "ON_TRACK" | "NEEDS_IMPROVEMENT" | "BEHIND" | "NO_TARGET" {
    if (target == null || target <= 0) return "NO_TARGET";
    const pct = current / target;
    if (pct >= 1) return "ON_TRACK";
    if (pct >= 0.5) return "NEEDS_IMPROVEMENT";
    return "BEHIND";
  }

  /** Reach "as of" a past date, reconstructed from timestamped snapshots rather than the current
   * live total — legacy MediaEngagementReachLog for the original system, Influencer2MetricValue
   * (LIKES+COMMENTS categories) for the new one. For each engagement/metric, takes the latest
   * snapshot recorded at or before the cutoff; anything with no snapshot that early is excluded
   * (it didn't exist yet, not zero) — same "reconstruct from history, never invent" principle as
   * MediaEngagementsService.reachMilestones(). */
  private async reachAsOf(organizationId: string, cutoff: Date, beneficiary: "mediaHostId" | "influencerId"): Promise<number> {
    const [engagements, campaignPlatforms] = await Promise.all([
      this.prisma.mediaEngagement.findMany({ where: { organizationId, [beneficiary]: { not: null } }, select: { id: true } }),
      this.prisma.influencer2CampaignPlatform.findMany({ where: { campaign: { organizationId, [beneficiary]: { not: null } } }, select: { id: true } }),
    ]);

    let sum = 0;

    if (engagements.length > 0) {
      const logs = await this.prisma.mediaEngagementReachLog.findMany({
        where: { mediaEngagementId: { in: engagements.map((e) => e.id) }, recordedAt: { lte: cutoff } },
        orderBy: { recordedAt: "asc" },
      });
      const latestByEngagement = new Map<string, { likes: number; comments: number }>();
      for (const log of logs) latestByEngagement.set(log.mediaEngagementId, { likes: log.likes, comments: log.comments });
      for (const v of latestByEngagement.values()) sum += v.likes + v.comments;
    }

    if (campaignPlatforms.length > 0) {
      const values = await this.prisma.influencer2MetricValue.findMany({
        where: {
          campaignPlatformId: { in: campaignPlatforms.map((cp) => cp.id) },
          collectedAt: { lte: cutoff },
          metricDefinition: { category: { in: ["LIKES", "COMMENTS"] } },
        },
        orderBy: { collectedAt: "asc" },
      });
      const latestByKey = new Map<string, number>();
      for (const v of values) latestByKey.set(`${v.campaignPlatformId}:${v.metricDefinitionId}`, Number(v.value));
      for (const v of latestByKey.values()) sum += v;
    }

    return sum;
  }

  /** The "how are we doing against target" report — current vs target vs a historical point
   * (monthsBack, or null for "since the org's earliest member" — the honest reading of "from where
   * we started"). Leaders have no historical comparison: isLeader has no change history (just a
   * live boolean on Member), so a "leaders 3 months ago" figure would have to guess from
   * registrationDate, which is wrong for anyone promoted to leader after joining — shown as a
   * current-vs-target snapshot only, never presented as if it were a real trend. */
  async performanceReport(organizationId: string, opts: { monthsBack: number | null; startDate?: Date; endDate?: Date }) {
    // `end` defaults to now, but a custom range (explicit startDate/endDate) lets the comparison
    // point itself be in the past too — "current" below really means "as of end", which is
    // identical to a live count when end is today.
    const end = opts.endDate ?? new Date();
    let cutoff: Date;
    if (opts.startDate) {
      cutoff = opts.startDate;
    } else if (opts.monthsBack == null) {
      const earliest = await this.prisma.member.findFirst({ where: { organizationId }, orderBy: { registrationDate: "asc" }, select: { registrationDate: true } });
      cutoff = earliest?.registrationDate ?? end;
    } else {
      cutoff = new Date(end);
      cutoff.setMonth(cutoff.getMonth() - opts.monthsBack);
    }

    const [endTotal, pastTotal, currentLeaders, org, endByRegion, pastByRegion, leadersByRegionNow, regionTargets, mediaReachEndMedia, mediaReachEndInfluencer, mediaReachPastMedia, mediaReachPastInfluencer] =
      await Promise.all([
        this.prisma.member.count({ where: { organizationId, registrationDate: { lte: end } } }),
        this.prisma.member.count({ where: { organizationId, registrationDate: { lte: cutoff } } }),
        this.prisma.member.count({ where: { organizationId, isLeader: true } }),
        this.prisma.organization.findUnique({ where: { id: organizationId }, select: { memberTarget: true, mediaReachTarget: true } }),
        this.prisma.member.groupBy({ by: ["region"], where: { organizationId, registrationDate: { lte: end } }, _count: { _all: true } }),
        this.prisma.member.groupBy({ by: ["region"], where: { organizationId, registrationDate: { lte: cutoff } }, _count: { _all: true } }),
        this.prisma.member.groupBy({ by: ["region"], where: { organizationId, isLeader: true }, _count: { _all: true } }),
        this.prisma.regionTarget.findMany({ where: { organizationId } }),
        this.reachAsOf(organizationId, end, "mediaHostId"),
        this.reachAsOf(organizationId, end, "influencerId"),
        this.reachAsOf(organizationId, cutoff, "mediaHostId"),
        this.reachAsOf(organizationId, cutoff, "influencerId"),
      ]);

    const pastByRegionMap = new Map(pastByRegion.map((r) => [r.region ?? "Unknown", r._count._all]));
    const leadersByRegionMap = new Map(leadersByRegionNow.map((r) => [r.region ?? "Unknown", r._count._all]));
    const targetByRegion = new Map(regionTargets.map((t) => [t.region, t]));

    const byRegion = endByRegion.map((r) => {
      const region = r.region ?? "Unknown";
      const memberTarget = targetByRegion.get(region)?.memberTarget ?? null;
      const leaderTarget = targetByRegion.get(region)?.leaderTarget ?? null;
      const leadersCurrent = leadersByRegionMap.get(region) ?? 0;
      return {
        region,
        members: {
          current: r._count._all,
          target: memberTarget,
          past: pastByRegionMap.get(region) ?? 0,
          pctOfTarget: memberTarget ? Math.round((r._count._all / memberTarget) * 1000) / 10 : null,
          varianceSincePast: r._count._all - (pastByRegionMap.get(region) ?? 0),
          direction: this.direction(r._count._all, memberTarget),
        },
        leaders: {
          current: leadersCurrent,
          target: leaderTarget,
          pctOfTarget: leaderTarget ? Math.round((leadersCurrent / leaderTarget) * 1000) / 10 : null,
          direction: this.direction(leadersCurrent, leaderTarget),
        },
      };
    });

    const mediaReachEnd = mediaReachEndMedia + mediaReachEndInfluencer;
    const mediaReachPast = mediaReachPastMedia + mediaReachPastInfluencer;
    const memberTarget = org?.memberTarget ?? null;
    const reachTarget = org?.mediaReachTarget ?? null;

    const members = {
      current: endTotal,
      target: memberTarget,
      past: pastTotal,
      pctOfTarget: memberTarget ? Math.round((endTotal / memberTarget) * 1000) / 10 : null,
      varianceSincePast: endTotal - pastTotal,
      direction: this.direction(endTotal, memberTarget),
    };
    const leaders = {
      current: currentLeaders,
      target: null as number | null,
      pctOfTarget: null as number | null,
      direction: "NO_TARGET" as const,
    };
    const mediaReach = {
      current: mediaReachEnd,
      target: reachTarget,
      past: mediaReachPast,
      pctOfTarget: reachTarget ? Math.round((mediaReachEnd / reachTarget) * 1000) / 10 : null,
      varianceSincePast: mediaReachEnd - mediaReachPast,
      direction: this.direction(mediaReachEnd, reachTarget),
    };

    const directions = [members.direction, mediaReach.direction, ...byRegion.map((r) => r.members.direction)].filter((d) => d !== "NO_TARGET");
    const overallDirection: "ON_TRACK" | "NEEDS_IMPROVEMENT" | "BEHIND" | "NO_TARGET" =
      directions.length === 0
        ? "NO_TARGET"
        : directions.includes("BEHIND")
          ? "BEHIND"
          : directions.includes("NEEDS_IMPROVEMENT")
            ? "NEEDS_IMPROVEMENT"
            : "ON_TRACK";

    return { cutoffDate: cutoff.toISOString(), endDate: end.toISOString(), members, leaders, byRegion, mediaReach, overallDirection };
  }

  async membersByType(organizationId: string) {
    const rows = await this.prisma.member.groupBy({
      by: ["membershipType"],
      where: { organizationId },
      _count: { _all: true },
    });
    return rows.map((r) => ({ membershipType: r.membershipType, count: r._count._all }));
  }

  async frequentAttendees(organizationId: string, minEvents = 3) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; membership_number: string; first_name: string; last_name: string; events_attended: bigint }>>(
      Prisma.sql`
        select m.id, m.membership_number, m.first_name, m.last_name, count(ar.id) as events_attended
        from members m
        join attendance_records ar on ar.member_id = m.id
        where m.organization_id = ${organizationId}
        group by m.id, m.membership_number, m.first_name, m.last_name
        having count(ar.id) >= ${minEvents}
        order by events_attended desc
        limit 100
      `,
    );
    // bigint doesn't survive JSON.stringify (Express res.json) — convert before returning.
    return rows.map((r) => ({ ...r, events_attended: Number(r.events_attended) }));
  }

  async neverAttended(organizationId: string) {
    return this.prisma.member.findMany({
      where: { organizationId, attendanceRecords: { none: {} } },
      select: { id: true, membershipNumber: true, firstName: true, lastName: true, registrationDate: true },
      take: 200,
    });
  }

  async inactiveMembers(organizationId: string, months = 12) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    return this.prisma.$queryRaw<Array<{ id: string; membership_number: string; first_name: string; last_name: string; last_attendance: Date | null }>>(
      Prisma.sql`
        select m.id, m.membership_number, m.first_name, m.last_name, max(ar.checked_in_at) as last_attendance
        from members m
        left join attendance_records ar on ar.member_id = m.id
        where m.organization_id = ${organizationId}
        group by m.id, m.membership_number, m.first_name, m.last_name
        having max(ar.checked_in_at) is null or max(ar.checked_in_at) < ${cutoff}
        limit 200
      `,
    );
  }

  async compareEvents(organizationId: string, eventIds: string[]) {
    const events = await this.prisma.event.findMany({ where: { id: { in: eventIds }, organizationId } });

    return Promise.all(
      events.map(async (event) => {
        const [registered, checkedIn, walkIns, newMembers] = await Promise.all([
          this.prisma.eventRegistration.count({ where: { eventId: event.id, registrationStatus: { in: ["REGISTERED", "APPROVED"] } } }),
          this.prisma.attendanceRecord.count({ where: { eventId: event.id } }),
          this.prisma.attendanceRecord.count({ where: { eventId: event.id, method: { in: ["WALK_IN", "OFFLINE_SYNC"] } } }),
          this.prisma.member.count({ where: { organizationId, registrationSource: "EVENT_WALK_IN", registrationDate: { gte: event.startDatetime, lte: event.endDatetime } } }),
        ]);
        return {
          eventId: event.id,
          name: event.name,
          registered,
          checkedIn,
          attendanceRate: registered > 0 ? checkedIn / registered : 0,
          walkIns,
          newMembers,
        };
      }),
    );
  }

  async attendanceTimeseries(organizationId: string, eventId: string, granularity: "hour" | "day" = "hour") {
    const bucket = truncateCheckedInAt(granularity);
    const rows = await this.prisma.$queryRaw<Array<{ bucket: string; check_ins: bigint }>>(Prisma.sql`
      select ${bucket} as bucket, count(*) as check_ins
      from attendance_records
      where organization_id = ${organizationId} and event_id = ${eventId}
      group by bucket
      order by bucket asc
    `);
    return rows.map((r) => ({ bucket: new Date(r.bucket), checkIns: Number(r.check_ins) }));
  }
}
