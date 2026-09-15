import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Influencer2CampaignStatus, Influencer2ContentType, Influencer2PaymentStatus } from "@event-intel/database";
import { Influencer2CampaignsService } from "./influencer2-campaigns.service";
import { CreateInfluencer2CampaignDto } from "./dto/create-influencer2-campaign.dto";
import { UpdateInfluencer2CampaignDto } from "./dto/update-influencer2-campaign.dto";
import { AddCampaignPlatformDto } from "./dto/add-campaign-platform.dto";
import { UpdateCampaignPlatformDto } from "./dto/update-campaign-platform.dto";
import { SubmitMetricsDto } from "./dto/submit-metrics.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";
import { StorageService, MAX_UPLOAD_BYTES, sanitizeExtension } from "../storage/storage.service";

const WRITE_ROLES = ["ORG_SUPER_ADMIN", "ORG_ADMIN"] as const;

@Controller("api/v1/organizations/:organizationId/influencer2/campaigns")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("influencers")
export class Influencer2CampaignsController {
  constructor(
    private readonly campaigns: Influencer2CampaignsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(
    @Param("organizationId") organizationId: string,
    @Query("influencerId") influencerId?: string,
    @Query("mediaHostId") mediaHostId?: string,
    @Query("platformKey") platformKey?: string,
    @Query("contentType") contentType?: Influencer2ContentType,
    @Query("status") status?: Influencer2CampaignStatus,
    @Query("paymentStatus") paymentStatus?: Influencer2PaymentStatus,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.campaigns.list(
      organizationId,
      { influencerId, mediaHostId, platformKey, contentType, status, paymentStatus, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined },
      Number(page) || 1,
      Number(pageSize) || 25,
    );
  }

  @Get("summary")
  summary(
    @Param("organizationId") organizationId: string,
    @Query("influencerId") influencerId?: string,
    @Query("mediaHostId") mediaHostId?: string,
    @Query("scope") scope?: "ALL_MEDIA_HOSTS" | "ALL_INFLUENCERS",
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    if (!influencerId && !mediaHostId && !scope) throw new BadRequestException("influencerId, mediaHostId, or scope query param is required");
    return this.campaigns.summary(organizationId, { influencerId, mediaHostId, scope, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined });
  }

  /** The drill-down behind the collective dashboards' stat tiles — every campaign for this scope/range, plus platform and media-type breakdowns. */
  @Get("report-details")
  reportDetails(
    @Param("organizationId") organizationId: string,
    @Query("scope") scope: "ALL_MEDIA_HOSTS" | "ALL_INFLUENCERS",
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    if (!scope) throw new BadRequestException("scope query param is required");
    return this.campaigns.reportDetails(organizationId, { scope, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined });
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreateInfluencer2CampaignDto, @CurrentUser() user: RequestUser) {
    const campaign = await this.campaigns.create(organizationId, dto, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer2_campaign.created", entityType: "influencer2_campaign", entityId: campaign.id });
    return campaign;
  }

  @Get(":campaignId")
  getDetail(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string) {
    return this.campaigns.getDetail(organizationId, campaignId);
  }

  @Patch(":campaignId")
  @Roles(...WRITE_ROLES)
  async update(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: UpdateInfluencer2CampaignDto,
    @CurrentUser() user: RequestUser,
  ) {
    const campaign = await this.campaigns.update(organizationId, campaignId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer2_campaign.updated", entityType: "influencer2_campaign", entityId: campaignId });
    return campaign;
  }

  @Delete(":campaignId")
  @Roles(...WRITE_ROLES)
  async remove(@Param("organizationId") organizationId: string, @Param("campaignId") campaignId: string, @CurrentUser() user: RequestUser) {
    const result = await this.campaigns.delete(organizationId, campaignId);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer2_campaign.deleted", entityType: "influencer2_campaign", entityId: campaignId });
    return result;
  }

  @Post(":campaignId/thumbnail")
  @Roles(...WRITE_ROLES)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadThumbnail(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded — expected a file under field name 'file'");
    const ext = sanitizeExtension(file.originalname, "bin");
    const url = await this.storage.upload(`influencer2/${organizationId}/${campaignId}.${ext}`, file.buffer, file.mimetype);
    return this.campaigns.setThumbnail(organizationId, campaignId, `${url}?v=${Date.now()}`);
  }

  @Post(":campaignId/platforms")
  @Roles(...WRITE_ROLES)
  async addPlatform(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Body() dto: AddCampaignPlatformDto,
    @CurrentUser() user: RequestUser,
  ) {
    const row = await this.campaigns.addPlatform(organizationId, campaignId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer2_campaign.platform_added", entityType: "influencer2_campaign_platform", entityId: row.id });
    return row;
  }

  @Patch(":campaignId/platforms/:campaignPlatformId")
  @Roles(...WRITE_ROLES)
  updatePlatform(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("campaignPlatformId") campaignPlatformId: string,
    @Body() dto: UpdateCampaignPlatformDto,
  ) {
    return this.campaigns.updatePlatform(organizationId, campaignId, campaignPlatformId, dto);
  }

  @Delete(":campaignId/platforms/:campaignPlatformId")
  @Roles(...WRITE_ROLES)
  removePlatform(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("campaignPlatformId") campaignPlatformId: string,
  ) {
    return this.campaigns.removePlatform(organizationId, campaignId, campaignPlatformId);
  }

  @Post(":campaignId/platforms/:campaignPlatformId/metrics")
  @Roles(...WRITE_ROLES)
  async submitMetrics(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("campaignPlatformId") campaignPlatformId: string,
    @Body() dto: SubmitMetricsDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.campaigns.submitMetrics(organizationId, campaignId, campaignPlatformId, dto, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer2_campaign.metrics_submitted", entityType: "influencer2_campaign_platform", entityId: campaignPlatformId });
    return result;
  }

  @Get(":campaignId/platforms/:campaignPlatformId/metrics/history")
  metricHistory(
    @Param("organizationId") organizationId: string,
    @Param("campaignId") campaignId: string,
    @Param("campaignPlatformId") campaignPlatformId: string,
    @Query("metricKey") metricKey: string,
  ) {
    if (!metricKey) throw new BadRequestException("metricKey query param is required");
    return this.campaigns.metricHistory(organizationId, campaignId, campaignPlatformId, metricKey);
  }
}
