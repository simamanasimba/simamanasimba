import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { MembersService } from "./members.service";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { SearchMembersDto } from "./dto/search-members.dto";
import { BulkMemberIdsDto } from "./dto/bulk-member-ids.dto";
import { BulkEmailMembersDto } from "./dto/bulk-email-members.dto";
import { MAX_UPLOAD_BYTES } from "../storage/storage.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";
import { toCsv, parseCsv } from "../../common/csv.util";

@Controller("api/v1/organizations/:organizationId/members")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
@RequiresArea("members")
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("members")
  search(@Param("organizationId") organizationId: string, @Query() query: SearchMembersDto) {
    return this.members.search(organizationId, query);
  }

  @Get("export")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("members")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="members.csv"')
  async export(@Param("organizationId") organizationId: string, @Query() query: SearchMembersDto, @Res() res: Response) {
    const rows = await this.members.exportRows(organizationId, query);
    res.send(
      toCsv(
        rows.map((m) => ({
          membershipNumber: m.membershipNumber,
          firstName: m.firstName,
          middleName: m.middleName,
          lastName: m.lastName,
          gender: m.gender,
          phone: m.phone,
          email: m.email,
          region: m.region,
          district: m.district,
          membershipType: m.membershipType,
          membershipStatus: m.membershipStatus,
          registrationDate: m.registrationDate.toISOString(),
        })),
      ),
    );
  }

  @Post("import")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async import(@Param("organizationId") organizationId: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    if (!file) throw new BadRequestException("No file uploaded — expected a CSV file under field name 'file'");
    const rows = parseCsv(file.buffer.toString("utf-8"));
    const result = await this.members.importRows(organizationId, rows);
    await this.audit.record({ organizationId, userId: user.id, action: "member.imported", entityType: "member", metadata: result });
    return result;
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreateMemberDto, @CurrentUser() user: RequestUser) {
    const member = await this.members.create(organizationId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "member.created", entityType: "member", entityId: member.id });
    return member;
  }

  @Get(":memberId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("members")
  getProfile(@Param("organizationId") organizationId: string, @Param("memberId") memberId: string) {
    return this.members.getProfile(organizationId, memberId);
  }

  @Patch(":memberId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: RequestUser,
  ) {
    const member = await this.members.update(organizationId, memberId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "member.updated", entityType: "member", entityId: memberId });
    return member;
  }

  @Delete(":memberId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async remove(@Param("organizationId") organizationId: string, @Param("memberId") memberId: string, @CurrentUser() user: RequestUser) {
    const result = await this.members.delete(organizationId, memberId);
    await this.audit.record({ organizationId, userId: user.id, action: "member.deleted", entityType: "member", entityId: memberId });
    return result;
  }

  @Post("bulk-delete")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async bulkDelete(@Param("organizationId") organizationId: string, @Body() dto: BulkMemberIdsDto, @CurrentUser() user: RequestUser) {
    const result = await this.members.bulkDelete(organizationId, dto.memberIds);
    await this.audit.record({ organizationId, userId: user.id, action: "member.bulk_deleted", entityType: "member", metadata: result });
    return result;
  }

  @Post("bulk-email")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async bulkEmail(@Param("organizationId") organizationId: string, @Body() dto: BulkEmailMembersDto, @CurrentUser() user: RequestUser) {
    const result = await this.members.bulkEmail(organizationId, dto.memberIds, dto.subject, dto.message);
    await this.audit.record({ organizationId, userId: user.id, action: "member.bulk_emailed", entityType: "member", metadata: result });
    return result;
  }
}
