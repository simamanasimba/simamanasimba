import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { createLogger } from "@event-intel/logger";
import { PrismaModule } from "./prisma/prisma.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { SearchIndexModule } from "./modules/search-index/search-index.module";
import { AiModule } from "./modules/ai/ai.module";
import { StorageModule } from "./modules/storage/storage.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { MembersModule } from "./modules/members/members.module";
import { EventsModule } from "./modules/events/events.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { MonitoringModule } from "./modules/monitoring/monitoring.module";
import { MentionsModule } from "./modules/mentions/mentions.module";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { SearchModule } from "./modules/search/search.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { PlatformCapabilitiesModule } from "./modules/platform-capabilities/platform-capabilities.module";
import { HealthModule } from "./modules/health/health.module";
import { InternalModule } from "./modules/internal/internal.module";
import { CampaignsModule } from "./modules/campaigns/campaigns.module";
import { MediaModule } from "./modules/media/media.module";
import { Influencer2Module } from "./modules/influencer2/influencer2.module";
import { BackupsModule } from "./modules/backups/backups.module";
import { DashboardSavedViewsModule } from "./modules/dashboard-saved-views/dashboard-saved-views.module";
import { SessionAuthGuard } from "./common/guards/session-auth.guard";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";

const appLogger = createLogger("api");

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    PermissionsModule,
    SearchIndexModule,
    AiModule,
    StorageModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    MembersModule,
    EventsModule,
    AttendanceModule,
    AnalyticsModule,
    MonitoringModule,
    MentionsModule,
    AlertsModule,
    SearchModule,
    ReportsModule,
    AuditLogsModule,
    PlatformCapabilitiesModule,
    InternalModule,
    CampaignsModule,
    MediaModule,
    Influencer2Module,
    BackupsModule,
    DashboardSavedViewsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_FILTER, useFactory: () => new AllExceptionsFilter(appLogger) },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
