import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { RegionTargetsController } from "./region-targets.controller";
import { RegionTargetsService } from "./region-targets.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { AuditService } from "../../common/audit.service";

@Module({
  controllers: [AnalyticsController, RegionTargetsController],
  providers: [AnalyticsService, RegionTargetsService, OrgMembershipGuard, AuditService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
