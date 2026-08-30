import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { MediaEngagementStatus } from "@event-intel/database";
import { MediaEngagementsService } from "./media-engagements.service";
import { CreateMediaEngagementDto } from "./dto/create-media-engagement.dto";
import { UpdateMediaEngagementDto } from "./dto/update-media-engagement.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/media-hosts/:hostId/engagements")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("media-hosts")
export class MediaHostEngagementsController {
  constructor(
    private readonly engagements: MediaEngagementsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(
    @Param("organizationId") organizationId: string,
    @Param("hostId") hostId: string,
    @Query("status") status?: MediaEngagementStatus,
  ) {
    return this.engagements.listForHost(organizationId, hostId, status);
  }

  @Get("paginated")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  listPaginated(
    @Param("organizationId") organizationId: string,
    @Param("hostId") hostId: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.engagements.listForHostPaginated(organizationId, hostId, Number(page) || 1, Number(pageSize) || 25);
  }

  @Get("content-per-week")
  contentPerWeek(@Param("organizationId") organizationId: string, @Param("hostId") hostId: string) {
    return this.engagements.contentPerWeek(organizationId, { mediaHostId: hostId });
  }

  @Get(":engagementId/reach-milestones")
  reachMilestones(@Param("organizationId") organizationId: string, @Param("engagementId") engagementId: string) {
    return this.engagements.reachMilestones(organizationId, engagementId);
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async create(
    @Param("organizationId") organizationId: string,
    @Param("hostId") hostId: string,
    @Body() dto: CreateMediaEngagementDto,
    @CurrentUser() user: RequestUser,
  ) {
    const row = await this.engagements.createForHost(organizationId, hostId, dto);
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
