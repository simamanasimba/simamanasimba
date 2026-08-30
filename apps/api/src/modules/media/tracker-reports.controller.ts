import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TrackerReportsService } from "./tracker-reports.service";
import { CreateTrackerReportDto } from "./dto/create-tracker-report.dto";
import { UpdateTrackerReportDto } from "./dto/update-tracker-report.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/media-campaigns/:campaignId/tracker-reports")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("tracker")
export class TrackerReportsController {
  constructor(
    private readonly reports: TrackerReportsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string) {
    return this.reports.list(organizationId, campaignId);
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async create(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: CreateTrackerReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    const row = await this.reports.create(organizationId, campaignId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "tracker_report.created", entityType: "tracker_report", entityId: row.id });
    return row;
  }

  @Patch(":reportId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("reportId") reportId: string,
    @Body() dto: UpdateTrackerReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    const row = await this.reports.update(organizationId, campaignId, reportId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "tracker_report.updated", entityType: "tracker_report", entityId: reportId });
    return row;
  }

  @Delete(":reportId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async remove(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("reportId") reportId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.reports.delete(organizationId, campaignId, reportId);
    await this.audit.record({ organizationId, userId: user.id, action: "tracker_report.deleted", entityType: "tracker_report", entityId: reportId });
    return result;
  }
}
