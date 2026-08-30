import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { RegionTargetsService } from "./region-targets.service";
import { UpsertRegionTargetsDto } from "./dto/upsert-region-targets.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

/** One numeric target per (organization, region) — the "center point" admins configure so the
 * Dashboard's members-by-region and leaders-by-region charts can show hover progress. Reading is
 * open to any org member (they need it to render their own dashboard); only admins can change it. */
@Controller("api/v1/organizations/:organizationId/region-targets")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class RegionTargetsController {
  constructor(
    private readonly targets: RegionTargetsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Param("organizationId") organizationId: string) {
    return this.targets.list(organizationId);
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async upsert(@Param("organizationId") organizationId: string, @Body() dto: UpsertRegionTargetsDto, @CurrentUser() user: RequestUser) {
    const rows = await this.targets.upsertMany(organizationId, dto.targets);
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "region_targets.updated",
      entityType: "region_target",
      metadata: { count: dto.targets.length },
    });
    return rows;
  }
}
