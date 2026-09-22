import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AttendanceService } from "./attendance.service";
import { RegisterDeviceDto } from "./dto/register-device.dto";
import { BulkAdminCheckinDto } from "./dto/bulk-admin-checkin.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";
import { MAX_UPLOAD_BYTES } from "../storage/storage.service";
import { parseCsv } from "../../common/csv.util";

@Controller("api/v1/organizations/:organizationId")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
@RequiresArea("events")
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly audit: AuditService,
  ) {}

  @Get("events/:eventId/attendance")
  list(@Param("organizationId") organizationId: string, @Param("eventId") eventId: string) {
    return this.attendance.listAttendance(organizationId, eventId);
  }

  @Get("events/:eventId/attendance/live")
  live(@Param("organizationId") organizationId: string, @Param("eventId") eventId: string) {
    return this.attendance.liveStats(organizationId, eventId);
  }

  @Post("events/:eventId/attendance/admin-checkin")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async adminCheckIn(
    @Param("organizationId") organizationId: string,
    @Param("eventId") eventId: string,
    @Body("memberId") memberId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.attendance.adminCheckIn(organizationId, eventId, memberId, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "attendance.admin_checkin", entityType: "attendance_record", entityId: memberId });
    return result;
  }

  /** Manual multi-select — pick several members from a list and check them all in at once. */
  @Post("events/:eventId/attendance/admin-checkin-bulk")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async adminCheckInBulk(
    @Param("organizationId") organizationId: string,
    @Param("eventId") eventId: string,
    @Body() dto: BulkAdminCheckinDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.attendance.adminCheckInBulk(organizationId, eventId, dto.memberIds, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "attendance.admin_checkin_bulk", entityType: "event", entityId: eventId, metadata: { checkedIn: result.checkedIn, alreadyCheckedIn: result.alreadyCheckedIn, notFound: result.notFound } });
    return result;
  }

  /** CSV/Excel-export upload — one membership number/campaign id per row. */
  @Post("events/:eventId/attendance/admin-checkin-import")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async adminCheckInImport(
    @Param("organizationId") organizationId: string,
    @Param("eventId") eventId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) throw new BadRequestException("No file uploaded — expected a CSV file under field name 'file'");
    const rows = parseCsv(file.buffer.toString("utf-8"));
    const result = await this.attendance.adminCheckInImport(organizationId, eventId, rows, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "attendance.admin_checkin_import", entityType: "event", entityId: eventId, metadata: { checkedIn: result.checkedIn, alreadyCheckedIn: result.alreadyCheckedIn, notFound: result.notFound, emptyRows: result.emptyRows } });
    return result;
  }

  @Get("attendance-devices")
  listDevices(@Param("organizationId") organizationId: string) {
    return this.attendance.listDevices(organizationId);
  }

  @Post("attendance-devices")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  registerDevice(@Param("organizationId") organizationId: string, @Body() dto: RegisterDeviceDto) {
    return this.attendance.registerDevice(organizationId, dto.name, dto.deviceType, dto.eventId);
  }

  @Patch("attendance-devices/:deviceId/heartbeat")
  heartbeat(@Param("organizationId") organizationId: string, @Param("deviceId") deviceId: string) {
    return this.attendance.heartbeatDevice(organizationId, deviceId);
  }
}
