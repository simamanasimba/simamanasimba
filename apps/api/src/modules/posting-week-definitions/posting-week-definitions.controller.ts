import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PostingWeekDefinitionsService } from "./posting-week-definitions.service";
import { CreateWeekDefinitionDto } from "./dto/create-week-definition.dto";
import { UpdateWeekDefinitionDto } from "./dto/update-week-definition.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

const WRITE_ROLES = ["ORG_SUPER_ADMIN", "ORG_ADMIN"] as const;

@Controller("api/v1/organizations/:organizationId/posting-week-definitions")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("settings")
export class PostingWeekDefinitionsController {
  constructor(
    private readonly weeks: PostingWeekDefinitionsService,
    private readonly audit: AuditService,
  ) {}

  // Open to any org member (overrides the class-level admin/finance-only roles for this one
  // route) — the shared date-range filter now reads this list on general-audience pages
  // (Dashboard, Members) so "weekly" can offer these week names to whoever can already see that
  // page, not just admins. Just names/dates, nothing sensitive.
  @Get()
  @Roles()
  list(@Param("organizationId") organizationId: string) {
    return this.weeks.list(organizationId);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreateWeekDefinitionDto, @CurrentUser() user: RequestUser) {
    const week = await this.weeks.create(organizationId, dto, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "posting_week_definition.created", entityType: "posting_week_definition", entityId: week.id });
    return week;
  }

  @Patch(":weekDefinitionId")
  @Roles(...WRITE_ROLES)
  async update(
    @Param("organizationId") organizationId: string,
    @Param("weekDefinitionId") weekDefinitionId: string,
    @Body() dto: UpdateWeekDefinitionDto,
    @CurrentUser() user: RequestUser,
  ) {
    const week = await this.weeks.update(organizationId, weekDefinitionId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "posting_week_definition.updated", entityType: "posting_week_definition", entityId: weekDefinitionId });
    return week;
  }

  @Delete(":weekDefinitionId")
  @Roles(...WRITE_ROLES)
  async remove(@Param("organizationId") organizationId: string, @Param("weekDefinitionId") weekDefinitionId: string, @CurrentUser() user: RequestUser) {
    const result = await this.weeks.remove(organizationId, weekDefinitionId);
    await this.audit.record({ organizationId, userId: user.id, action: "posting_week_definition.deleted", entityType: "posting_week_definition", entityId: weekDefinitionId });
    return result;
  }
}
