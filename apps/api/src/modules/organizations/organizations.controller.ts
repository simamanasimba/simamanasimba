import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { OrganizationsService } from "./organizations.service";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { InviteUserDto } from "./dto/invite-user.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";
import { StorageService, MAX_UPLOAD_BYTES, sanitizeExtension } from "../storage/storage.service";

@Controller("api/v1/organizations/:organizationId")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  get(@Param("organizationId") organizationId: string) {
    return this.organizations.getById(organizationId);
  }

  @Post("branding/logo")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("settings")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadLogo(@Param("organizationId") organizationId: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    if (!file) throw new BadRequestException("No file uploaded — expected an image file under field name 'file'");
    if (!file.mimetype.startsWith("image/")) throw new BadRequestException("Logo must be an image file");

    const ext = sanitizeExtension(file.originalname, "png");
    const logoUrl = await this.storage.upload(`branding/${organizationId}/logo.${ext}`, file.buffer, file.mimetype);
    const org = await this.organizations.update(organizationId, { logoUrl: `${logoUrl}?v=${Date.now()}` });
    await this.audit.record({ organizationId, userId: user.id, action: "organization.logo_updated", entityType: "organization", entityId: organizationId });
    return org;
  }

  @Post("branding/hero")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("settings")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadHeroImage(@Param("organizationId") organizationId: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    if (!file) throw new BadRequestException("No file uploaded — expected an image file under field name 'file'");
    if (!file.mimetype.startsWith("image/")) throw new BadRequestException("Hero image must be an image file");

    const ext = sanitizeExtension(file.originalname, "jpg");
    const heroImageUrl = await this.storage.upload(`branding/${organizationId}/hero.${ext}`, file.buffer, file.mimetype);
    const org = await this.organizations.update(organizationId, { heroImageUrl: `${heroImageUrl}?v=${Date.now()}` });
    await this.audit.record({ organizationId, userId: user.id, action: "organization.hero_image_updated", entityType: "organization", entityId: organizationId });
    return org;
  }

  @Post("branding/hero-slides")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("settings")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadHeroSlide(@Param("organizationId") organizationId: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    if (!file) throw new BadRequestException("No file uploaded — expected an image file under field name 'file'");
    if (!file.mimetype.startsWith("image/")) throw new BadRequestException("Slide image must be an image file");

    const ext = sanitizeExtension(file.originalname, "jpg");
    const imageUrl = await this.storage.upload(`branding/${organizationId}/hero-slide-${Date.now()}.${ext}`, file.buffer, file.mimetype);
    const org = await this.organizations.addHeroSlide(organizationId, imageUrl);
    await this.audit.record({ organizationId, userId: user.id, action: "organization.hero_slide_added", entityType: "organization", entityId: organizationId });
    return org;
  }

  @Delete("branding/hero-slides")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("settings")
  async removeHeroSlide(@Param("organizationId") organizationId: string, @Body() dto: { url: string }, @CurrentUser() user: RequestUser) {
    if (!dto.url) throw new BadRequestException("url is required");
    const org = await this.organizations.removeHeroSlide(organizationId, dto.url);
    await this.audit.record({ organizationId, userId: user.id, action: "organization.hero_slide_removed", entityType: "organization", entityId: organizationId });
    return org;
  }

  @Patch()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("settings")
  async update(@Param("organizationId") organizationId: string, @Body() dto: UpdateOrganizationDto, @CurrentUser() user: RequestUser) {
    const org = await this.organizations.update(organizationId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "organization.updated", entityType: "organization", entityId: organizationId });
    return org;
  }

  @Get("users")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("access-control")
  listMembers(@Param("organizationId") organizationId: string) {
    return this.organizations.listMembers(organizationId);
  }

  @Post("users/invite")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("access-control")
  async invite(@Param("organizationId") organizationId: string, @Body() dto: InviteUserDto, @CurrentUser() user: RequestUser) {
    const membership = await this.organizations.inviteUser(organizationId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "organization.user_invited", entityType: "user", entityId: membership.userId });
    return membership;
  }

  @Patch("users/:userId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("access-control")
  async updateMember(
    @Param("organizationId") organizationId: string,
    @Param("userId") userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const membership = await this.organizations.updateMember(organizationId, userId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "organization.user_updated", entityType: "user", entityId: userId });
    return membership;
  }

  // Deleting a member's access is one-way and permanent — deliberately Super Admin only, unlike
  // invite/role-change/suspend above which a normal Admin can also do.
  @Delete("users/:userId")
  @Roles("ORG_SUPER_ADMIN")
  @RequiresArea("access-control")
  async removeMember(@Param("organizationId") organizationId: string, @Param("userId") userId: string, @CurrentUser() user: RequestUser) {
    const membership = await this.organizations.removeMember(organizationId, userId);
    await this.audit.record({ organizationId, userId: user.id, action: "organization.user_removed", entityType: "user", entityId: userId });
    return membership;
  }
}
