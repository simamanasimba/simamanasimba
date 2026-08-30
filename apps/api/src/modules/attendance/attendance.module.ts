import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { PublicAttendanceController } from "./public-attendance.controller";
import { AttendanceService } from "./attendance.service";
import { MembersModule } from "../members/members.module";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { AuditService } from "../../common/audit.service";

@Module({
  imports: [MembersModule],
  controllers: [AttendanceController, PublicAttendanceController],
  providers: [AttendanceService, OrgMembershipGuard, AuditService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
