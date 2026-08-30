import { Module } from "@nestjs/common";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { AuditService } from "../../common/audit.service";

@Module({
  imports: [NotificationsModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, OrgMembershipGuard, AuditService],
})
export class CampaignsModule {}
