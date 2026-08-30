import { Module } from "@nestjs/common";
import { MembersController } from "./members.controller";
import { PublicMembersController } from "./public-members.controller";
import { MembersService } from "./members.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { AuditService } from "../../common/audit.service";

@Module({
  imports: [NotificationsModule],
  controllers: [MembersController, PublicMembersController],
  providers: [MembersService, OrgMembershipGuard, AuditService],
  exports: [MembersService],
})
export class MembersModule {}
