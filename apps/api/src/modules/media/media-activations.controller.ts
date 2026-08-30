import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { MediaActivationsService } from "./media-activations.service";
import { CreateMediaActivationDto } from "./dto/create-media-activation.dto";
import { UpdateMediaActivationDto } from "./dto/update-media-activation.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/media-campaigns/:campaignId/activations")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class MediaActivationsController {
  constructor(
    private readonly activations: MediaActivationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string) {
    return this.activations.list(organizationId, campaignId);
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async create(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: CreateMediaActivationDto,
    @CurrentUser() user: RequestUser,
  ) {
    const row = await this.activations.create(organizationId, campaignId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "media_activation.created", entityType: "media_activation", entityId: row.id });
    return row;
  }

  @Patch(":activationId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("activationId") activationId: string,
    @Body() dto: UpdateMediaActivationDto,
    @CurrentUser() user: RequestUser,
  ) {
    const row = await this.activations.update(organizationId, campaignId, activationId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "media_activation.updated", entityType: "media_activation", entityId: activationId });
    return row;
  }

  @Delete(":activationId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async remove(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("activationId") activationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.activations.delete(organizationId, campaignId, activationId);
    await this.audit.record({ organizationId, userId: user.id, action: "media_activation.deleted", entityType: "media_activation", entityId: activationId });
    return result;
  }
}
