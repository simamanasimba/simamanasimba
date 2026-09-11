import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { DashboardSavedViewsService } from "./dashboard-saved-views.service";
import { CreateSavedViewDto } from "./dto/create-saved-view.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";

/** Named, saved date ranges for the Media/Influencer dashboards' filter — "Week 1", "Week 2", etc.
 * Shared across the whole org (a team reference period, not a personal setting), so any active
 * member can list/create/delete — same low-stakes, no-role-restriction model as a bookmark. */
@Controller("api/v1/organizations/:organizationId/dashboard-saved-views")
@UseGuards(OrgMembershipGuard)
export class DashboardSavedViewsController {
  constructor(private readonly views: DashboardSavedViewsService) {}

  @Get()
  list(@Param("organizationId") organizationId: string) {
    return this.views.list(organizationId);
  }

  @Post()
  create(@Param("organizationId") organizationId: string, @Body() dto: CreateSavedViewDto, @CurrentUser() user: RequestUser) {
    return this.views.create(organizationId, user.id, dto);
  }

  @Delete(":id")
  remove(@Param("organizationId") organizationId: string, @Param("id") id: string) {
    return this.views.remove(organizationId, id);
  }
}
