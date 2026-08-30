import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { AnalyticsModule } from "../analytics/analytics.module";
import { EventsModule } from "../events/events.module";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";

@Module({
  imports: [AnalyticsModule, EventsModule],
  controllers: [ReportsController],
  providers: [ReportsService, OrgMembershipGuard],
})
export class ReportsModule {}
