import { Module } from "@nestjs/common";
import { DashboardSavedViewsController } from "./dashboard-saved-views.controller";
import { DashboardSavedViewsService } from "./dashboard-saved-views.service";

@Module({
  controllers: [DashboardSavedViewsController],
  providers: [DashboardSavedViewsService],
})
export class DashboardSavedViewsModule {}
