import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { MediaHostsService } from "./media-hosts.service";
import { MediaEngagementOverviewService } from "./media-engagement-overview.service";
import { CreateMediaHostDto } from "./dto/create-media-host.dto";
import { UpdateMediaHostDto } from "./dto/update-media-host.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/media-hosts")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("media-hosts")
export class MediaHostsController {
  constructor(
    private readonly mediaHosts: MediaHostsService,
    private readonly engagementOverview: MediaEngagementOverviewService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Query("mediaOutletId") mediaOutletId?: string) {
    return this.mediaHosts.list(organizationId, mediaOutletId);
  }

  // Registered before ":hostId" so the literal path isn't swallowed by the param route.
  @Get("engagement-overview")
  overview(@Param("organizationId") organizationId: string, @Query("from") from?: string, @Query("to") to?: string) {
    const range = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    return this.engagementOverview.overview(organizationId, range);
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreateMediaHostDto, @CurrentUser() user: RequestUser) {
    const host = await this.mediaHosts.create(organizationId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "media_host.created", entityType: "media_host", entityId: host.id });
    return host;
  }

  @Get(":hostId")
  getProfile(@Param("organizationId") organizationId: string, @Param("hostId") hostId: string) {
    return this.mediaHosts.getProfile(organizationId, hostId);
  }

  @Patch(":hostId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("hostId") hostId: string,
    @Body() dto: UpdateMediaHostDto,
    @CurrentUser() user: RequestUser,
  ) {
    const host = await this.mediaHosts.update(organizationId, hostId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "media_host.updated", entityType: "media_host", entityId: hostId });
    return host;
  }

  @Delete(":hostId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async remove(@Param("organizationId") organizationId: string, @Param("hostId") hostId: string, @CurrentUser() user: RequestUser) {
    const result = await this.mediaHosts.remove(organizationId, hostId);
    await this.audit.record({ organizationId, userId: user.id, action: "media_host.deleted", entityType: "media_host", entityId: hostId });
    return result;
  }
}
