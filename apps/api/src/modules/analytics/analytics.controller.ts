import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";

@Controller("api/v1/organizations/:organizationId/analytics")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("membership-growth")
  membershipGrowth(
    @Param("organizationId") organizationId: string,
    @Query("interval") interval?: "day" | "week" | "month" | "quarter" | "year",
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.analytics.membershipGrowth(organizationId, interval, from, to);
  }

  @Get("membership-summary")
  membershipSummary(@Param("organizationId") organizationId: string) {
    return this.analytics.membershipSummary(organizationId);
  }

  @Get("members/by-region")
  byRegion(@Param("organizationId") organizationId: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.analytics.membersByRegion(organizationId, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get("members/by-region/leaders")
  byRegionLeaders(@Param("organizationId") organizationId: string) {
    return this.analytics.leadersByRegion(organizationId);
  }

  @Get("media-reach")
  mediaReach(@Param("organizationId") organizationId: string) {
    return this.analytics.mediaReachSummary(organizationId);
  }

  // Target-vs-actual comparison report — Finance/admins only (or an admin-granted extra role),
  // same gate as the rest of the Finance Reports area, since this is explicitly meant to be a
  // reviewed report, not open to every org member like the other analytics endpoints above.
  @Get("performance-report")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  @RequiresArea("finance")
  performanceReport(
    @Param("organizationId") organizationId: string,
    @Query("monthsBack") monthsBack?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.analytics.performanceReport(organizationId, {
      monthsBack: monthsBack ? Number(monthsBack) : null,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get("members/by-type")
  byType(@Param("organizationId") organizationId: string) {
    return this.analytics.membersByType(organizationId);
  }

  @Get("members/frequent")
  frequent(@Param("organizationId") organizationId: string, @Query("minEvents") minEvents?: string) {
    return this.analytics.frequentAttendees(organizationId, minEvents ? Number(minEvents) : undefined);
  }

  @Get("members/never-attended")
  neverAttended(@Param("organizationId") organizationId: string) {
    return this.analytics.neverAttended(organizationId);
  }

  @Get("members/inactive")
  inactive(@Param("organizationId") organizationId: string, @Query("months") months?: string) {
    return this.analytics.inactiveMembers(organizationId, months ? Number(months) : undefined);
  }

  @Get("events/compare")
  compareEvents(@Param("organizationId") organizationId: string, @Query("eventIds") eventIds: string) {
    return this.analytics.compareEvents(organizationId, eventIds ? eventIds.split(",") : []);
  }

  @Get("events/:eventId/timeseries")
  timeseries(
    @Param("organizationId") organizationId: string,
    @Param("eventId") eventId: string,
    @Query("granularity") granularity?: "hour" | "day",
  ) {
    return this.analytics.attendanceTimeseries(organizationId, eventId, granularity);
  }
}
