import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { MediaCampaignsService } from "./media-campaigns.service";
import { CreateMediaCampaignDto } from "./dto/create-media-campaign.dto";
import { UpdateMediaCampaignDto } from "./dto/update-media-campaign.dto";
import { LinkMediaHostDto, LinkInfluencerDto } from "./dto/link-subject.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/media-campaigns")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class MediaCampaignsController {
  constructor(
    private readonly campaigns: MediaCampaignsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Param("organizationId") organizationId: string) {
    return this.campaigns.list(organizationId);
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreateMediaCampaignDto, @CurrentUser() user: RequestUser) {
    const campaign = await this.campaigns.create(organizationId, dto, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "media_campaign.created", entityType: "media_campaign", entityId: campaign.id });
    return campaign;
  }

  @Get(":campaignId")
  getById(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string) {
    return this.campaigns.getById(organizationId, campaignId);
  }

  @Patch(":campaignId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: UpdateMediaCampaignDto,
    @CurrentUser() user: RequestUser,
  ) {
    const campaign = await this.campaigns.update(organizationId, campaignId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "media_campaign.updated", entityType: "media_campaign", entityId: campaignId });
    return campaign;
  }

  @Delete(":campaignId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async remove(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string, @CurrentUser() user: RequestUser) {
    const result = await this.campaigns.remove(organizationId, campaignId);
    await this.audit.record({ organizationId, userId: user.id, action: "media_campaign.deleted", entityType: "media_campaign", entityId: campaignId });
    return result;
  }

  @Get(":campaignId/summary")
  getSummary(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string) {
    return this.campaigns.getSummary(organizationId, campaignId);
  }

  @Get(":campaignId/financial-summary")
  getFinancialSummary(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string) {
    return this.campaigns.getFinancialSummary(organizationId, campaignId);
  }

  @Get(":campaignId/media-hosts/comparison")
  getHostComparison(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string) {
    return this.campaigns.getHostComparison(organizationId, campaignId);
  }

  @Get(":campaignId/influencers/comparison")
  getInfluencerComparison(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string) {
    return this.campaigns.getInfluencerComparison(organizationId, campaignId);
  }

  @Post(":campaignId/media-hosts")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async addMediaHost(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: LinkMediaHostDto,
    @CurrentUser() user: RequestUser,
  ) {
    const link = await this.campaigns.linkMediaHost(organizationId, campaignId, dto.mediaHostId);
    await this.audit.record({ organizationId, userId: user.id, action: "media_campaign.host_linked", entityType: "media_campaign", entityId: campaignId });
    return link;
  }

  @Delete(":campaignId/media-hosts/:mediaHostId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async removeMediaHost(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("mediaHostId") mediaHostId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.campaigns.unlinkMediaHost(organizationId, campaignId, mediaHostId);
    await this.audit.record({ organizationId, userId: user.id, action: "media_campaign.host_unlinked", entityType: "media_campaign", entityId: campaignId });
    return result;
  }

  @Post(":campaignId/influencers")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async addInfluencer(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: LinkInfluencerDto,
    @CurrentUser() user: RequestUser,
  ) {
    const link = await this.campaigns.linkInfluencer(organizationId, campaignId, dto.influencerId);
    await this.audit.record({ organizationId, userId: user.id, action: "media_campaign.influencer_linked", entityType: "media_campaign", entityId: campaignId });
    return link;
  }

  @Delete(":campaignId/influencers/:influencerId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async removeInfluencer(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("influencerId") influencerId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.campaigns.unlinkInfluencer(organizationId, campaignId, influencerId);
    await this.audit.record({ organizationId, userId: user.id, action: "media_campaign.influencer_unlinked", entityType: "media_campaign", entityId: campaignId });
    return result;
  }
}
