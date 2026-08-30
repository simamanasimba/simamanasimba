import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AttendanceService } from "./attendance.service";
import { RegisterDeviceDto } from "./dto/register-device.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

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
