import { Module } from "@nestjs/common";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringService } from "./monitoring.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";

@Module({
  controllers: [MonitoringController],
  providers: [MonitoringService, OrgMembershipGuard],
  exports: [MonitoringService],
})
export class MonitoringModule {}
