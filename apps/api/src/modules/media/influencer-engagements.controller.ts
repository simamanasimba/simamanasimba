import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { MediaEngagementStatus } from "@event-intel/database";
import { MediaEngagementsService } from "./media-engagements.service";
import { CreateMediaEngagementDto } from "./dto/create-media-engagement.dto";
import { UpdateMediaEngagementDto } from "./dto/update-media-engagement.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/influencers/:influencerId/engagements")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class InfluencerEngagementsController {
  constructor(
    private readonly engagements: MediaEngagementsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(
    @Param("organizationId") organizationId: string,
    @Param("influencerId") influencerId: string,
    @Query("status") status?: MediaEngagementStatus,
  ) {
    return this.engagements.listForInfluencer(organizationId, influencerId, status);
  }

  @Get("paginated")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  listPaginated(
    @Param("organizationId") organizationId: string,
    @Param("influencerId") influencerId: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.engagements.listForInfluencerPaginated(organizationId, influencerId, Number(page) || 1, Number(pageSize) || 25);
  }

  @Get("content-per-week")
  contentPerWeek(@Param("organizationId") organizationId: string, @Param("influencerId") influencerId: string) {
    return this.engagements.contentPerWeek(organizationId, { influencerId });
  }

  @Get(":engagementId/reach-milestones")
  reachMilestones(@Param("organizationId") organizationId: string, @Param("engagementId") engagementId: string) {
    return this.engagements.reachMilestones(organizationId, engagementId);
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async create(
    @Param("organizationId") organizationId: string,
    @Param("influencerId") influencerId: string,
    @Body() dto: CreateMediaEngagementDto,
    @CurrentUser() user: RequestUser,
  ) {
    const row = await this.engagements.createForInfluencer(organizationId, influencerId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "media_engagement.created", entityType: "media_engagement", entityId: row.id });
    return row;
  }

  @Patch(":engagementId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("engagementId") engagementId: string,
    @Body() dto: UpdateMediaEngagementDto,
    @CurrentUser() user: RequestUser,
  ) {
    const row = await this.engagements.update(organizationId, engagementId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "media_engagement.updated", entityType: "media_engagement", entityId: engagementId });
    return row;
  }

  @Delete(":engagementId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async remove(
    @Param("organizationId") organizationId: string,
    @Param("engagementId") engagementId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.engagements.delete(organizationId, engagementId);
    await this.audit.record({ organizationId, userId: user.id, action: "media_engagement.deleted", entityType: "media_engagement", entityId: engagementId });
    return result;
  }
}
