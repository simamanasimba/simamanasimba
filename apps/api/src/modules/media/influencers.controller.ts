import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { InfluencersService } from "./influencers.service";
import { CreateInfluencerDto } from "./dto/create-influencer.dto";
import { UpdateInfluencerDto } from "./dto/update-influencer.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";
import { StorageService, MAX_UPLOAD_BYTES, sanitizeExtension } from "../storage/storage.service";

@Controller("api/v1/organizations/:organizationId/influencers")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("influencers")
export class InfluencersController {
  constructor(
    private readonly influencers: InfluencersService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(@Param("organizationId") organizationId: string) {
    return this.influencers.list(organizationId);
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreateInfluencerDto, @CurrentUser() user: RequestUser) {
    const influencer = await this.influencers.create(organizationId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer.created", entityType: "influencer", entityId: influencer.id });
    return influencer;
  }

  @Get(":influencerId")
  getProfile(@Param("organizationId") organizationId: string, @Param("influencerId") influencerId: string) {
    return this.influencers.getProfile(organizationId, influencerId);
  }

  @Post(":influencerId/agreement")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadAgreement(
    @Param("organizationId") organizationId: string,
    @Param("influencerId") influencerId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) throw new BadRequestException("No file uploaded — expected a file under field name 'file'");
    const ext = sanitizeExtension(file.originalname, "bin");
    const url = await this.storage.upload(`influencers/${organizationId}/${influencerId}-agreement.${ext}`, file.buffer, file.mimetype);
    const influencer = await this.influencers.setAgreement(organizationId, influencerId, `${url}?v=${Date.now()}`);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer.agreement_uploaded", entityType: "influencer", entityId: influencerId });
    return influencer;
  }

  @Patch(":influencerId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("influencerId") influencerId: string,
    @Body() dto: UpdateInfluencerDto,
    @CurrentUser() user: RequestUser,
  ) {
    const influencer = await this.influencers.update(organizationId, influencerId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer.updated", entityType: "influencer", entityId: influencerId });
    return influencer;
  }

  @Delete(":influencerId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async remove(@Param("organizationId") organizationId: string, @Param("influencerId") influencerId: string, @CurrentUser() user: RequestUser) {
    const result = await this.influencers.remove(organizationId, influencerId);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer.deleted", entityType: "influencer", entityId: influencerId });
    return result;
  }
}
