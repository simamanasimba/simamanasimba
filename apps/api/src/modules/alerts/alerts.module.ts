import { Module } from "@nestjs/common";
import { AlertsController } from "./alerts.controller";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";

@Module({
  controllers: [AlertsController],
  providers: [OrgMembershipGuard],
})
export class AlertsModule {}
