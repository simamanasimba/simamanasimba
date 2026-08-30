import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import { SetRolePermissionDto } from "./dto/set-role-permission.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/role-permissions")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class PermissionsController {
  constructor(
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  // Open to any org member (like GET users) — every user's own frontend nav filtering needs to
  // read the effective matrix to know what's been granted to their role.
  @Get()
  getMatrix(@Param("organizationId") organizationId: string) {
    return this.permissions.getMatrix(organizationId);
  }

  @Patch()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async setOverride(@Param("organizationId") organizationId: string, @Body() dto: SetRolePermissionDto, @CurrentUser() user: RequestUser) {
    const result = await this.permissions.setOverride(organizationId, dto.role, dto.area, dto.action, dto.allowed);
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "organization.role_permission_updated",
      entityType: "org_role_permission",
      entityId: `${dto.role}:${dto.area}:${dto.action}`,
      metadata: { allowed: dto.allowed },
    });
    return result;
  }
}
