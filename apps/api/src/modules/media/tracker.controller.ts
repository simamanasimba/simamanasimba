import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type { TrackerSessionStatus } from "@event-intel/database";
import { TrackerService } from "./tracker.service";
import { CreateTrackerMetricDto } from "./dto/create-tracker-metric.dto";
import { UpdateTrackerMetricDto } from "./dto/update-tracker-metric.dto";
import { CreateSessionDto } from "./dto/create-session.dto";
import { BulkEntriesDto } from "./dto/bulk-entries.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/media-campaigns/:campaignId")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class TrackerController {
  constructor(
    private readonly tracker: TrackerService,
    private readonly audit: AuditService,
  ) {}

  @Get("metrics")
  listMetrics(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string) {
    return this.tracker.listMetrics(organizationId, campaignId);
  }

  @Post("metrics")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async createMetric(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: CreateTrackerMetricDto,
    @CurrentUser() user: RequestUser,
  ) {
    const metric = await this.tracker.createMetric(organizationId, campaignId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "tracker_metric.created", entityType: "tracker_metric", entityId: metric.id });
    return metric;
  }

  @Patch("metrics/:metricId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async updateMetric(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("metricId") metricId: string,
    @Body() dto: UpdateTrackerMetricDto,
    @CurrentUser() user: RequestUser,
  ) {
    const metric = await this.tracker.updateMetric(organizationId, campaignId, metricId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "tracker_metric.updated", entityType: "tracker_metric", entityId: metricId });
    return metric;
  }

  @Delete("metrics/:metricId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async deleteMetric(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("metricId") metricId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.tracker.deleteMetric(organizationId, campaignId, metricId);
    await this.audit.record({ organizationId, userId: user.id, action: "tracker_metric.deleted", entityType: "tracker_metric", entityId: metricId });
    return result;
  }

  @Get("sessions")
  listSessions(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string) {
    return this.tracker.listSessions(organizationId, campaignId);
  }

  @Post("sessions")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async createSession(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: RequestUser,
  ) {
    const session = await this.tracker.createSession(organizationId, campaignId, dto, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "tracker_session.created", entityType: "tracker_session", entityId: session.session.id });
    return session;
  }

  @Get("sessions/:sessionId")
  getSessionDetail(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("sessionId") sessionId: string,
  ) {
    return this.tracker.getSessionDetail(organizationId, campaignId, sessionId);
  }

  @Patch("sessions/:sessionId/status")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async updateSessionStatus(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("sessionId") sessionId: string,
    @Body("status") status: TrackerSessionStatus,
    @CurrentUser() user: RequestUser,
  ) {
    const session = await this.tracker.updateSessionStatus(organizationId, campaignId, sessionId, status, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "tracker_session.status_changed", entityType: "tracker_session", entityId: sessionId, metadata: { status } });
    return session;
  }

  @Post("sessions/:sessionId/entries")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async saveEntries(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: BulkEntriesDto,
    @CurrentUser() user: RequestUser,
  ) {
    const saved = await this.tracker.saveEntries(organizationId, campaignId, sessionId, dto, user.id);
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "tracker_session.entries_saved",
      entityType: "tracker_session",
      entityId: sessionId,
      metadata: { count: saved.length },
    });
    return saved;
  }
}
