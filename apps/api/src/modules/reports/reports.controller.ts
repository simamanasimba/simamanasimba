import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { GenerateReportDto } from "./dto/generate-report.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";

@Controller("api/v1/organizations/:organizationId/reports")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
@RequiresArea("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(@Param("organizationId") organizationId: string) {
    return this.reports.list(organizationId);
  }

  @Post()
  generate(@Param("organizationId") organizationId: string, @Body() dto: GenerateReportDto, @CurrentUser() user: RequestUser) {
    return this.reports.generate(organizationId, dto.type, dto.format, dto.parameters ?? {}, user.id);
  }

  @Get(":reportId")
  get(@Param("organizationId") organizationId: string, @Param("reportId") reportId: string) {
    return this.reports.get(organizationId, reportId);
  }
}
