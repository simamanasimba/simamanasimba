import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Influencer2FoldersService } from "./influencer2-folders.service";
import { CreateFolderDto } from "./dto/create-folder.dto";
import { UpdateFolderDto } from "./dto/update-folder.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

const WRITE_ROLES = ["ORG_SUPER_ADMIN", "ORG_ADMIN"] as const;

@Controller("api/v1/organizations/:organizationId/influencer2/folders")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("influencers")
export class Influencer2FoldersController {
  constructor(
    private readonly folders: Influencer2FoldersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Query("mediaHostId") mediaHostId?: string, @Query("influencerId") influencerId?: string) {
    return this.folders.list(organizationId, { mediaHostId, influencerId });
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreateFolderDto, @CurrentUser() user: RequestUser) {
    const folder = await this.folders.create(organizationId, dto, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer2_folder.created", entityType: "influencer2_folder", entityId: folder.id });
    return folder;
  }

  @Patch(":folderId")
  @Roles(...WRITE_ROLES)
  async update(
    @Param("organizationId") organizationId: string,
    @Param("folderId") folderId: string,
    @Body() dto: UpdateFolderDto,
    @CurrentUser() user: RequestUser,
  ) {
    const folder = await this.folders.update(organizationId, folderId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer2_folder.updated", entityType: "influencer2_folder", entityId: folderId });
    return folder;
  }

  @Delete(":folderId")
  @Roles(...WRITE_ROLES)
  async remove(@Param("organizationId") organizationId: string, @Param("folderId") folderId: string, @CurrentUser() user: RequestUser) {
    const result = await this.folders.remove(organizationId, folderId);
    await this.audit.record({ organizationId, userId: user.id, action: "influencer2_folder.deleted", entityType: "influencer2_folder", entityId: folderId });
    return result;
  }
}
