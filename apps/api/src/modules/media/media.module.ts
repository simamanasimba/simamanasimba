import { Module } from "@nestjs/common";
import { MediaHostsController } from "./media-hosts.controller";
import { MediaHostsService } from "./media-hosts.service";
import { InfluencersController } from "./influencers.controller";
import { InfluencersService } from "./influencers.service";
import { MediaCampaignsController } from "./media-campaigns.controller";
import { MediaCampaignsService } from "./media-campaigns.service";
import { TrackerController } from "./tracker.controller";
import { TrackerService } from "./tracker.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { MediaActivationsController } from "./media-activations.controller";
import { MediaActivationsService } from "./media-activations.service";
import { TrackerReportsController } from "./tracker-reports.controller";
import { TrackerReportsService } from "./tracker-reports.service";
import { MediaEngagementsService } from "./media-engagements.service";
import { MediaHostEngagementsController } from "./media-host-engagements.controller";
import { InfluencerEngagementsController } from "./influencer-engagements.controller";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { MediaOutletsController } from "./media-outlets.controller";
import { MediaOutletsService } from "./media-outlets.service";
import { MediaCatalogSeedService } from "./media-catalog-seed.service";
import { MediaEngagementOverviewService } from "./media-engagement-overview.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { AuditService } from "../../common/audit.service";

@Module({
  controllers: [
    MediaHostsController,
    InfluencersController,
    MediaCampaignsController,
    TrackerController,
    PaymentsController,
    MediaActivationsController,
    TrackerReportsController,
    MediaHostEngagementsController,
    InfluencerEngagementsController,
    ExpensesController,
    MediaOutletsController,
  ],
  providers: [
    MediaHostsService,
    InfluencersService,
    MediaCampaignsService,
    TrackerService,
    PaymentsService,
    MediaActivationsService,
    TrackerReportsService,
    MediaEngagementsService,
    ExpensesService,
    OrgMembershipGuard,
    AuditService,
    MediaOutletsService,
    MediaCatalogSeedService,
    MediaEngagementOverviewService,
  ],
})
export class MediaModule {}
