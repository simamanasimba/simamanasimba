import { Module } from "@nestjs/common";
import { Influencer2PlatformsController } from "./influencer2-platforms.controller";
import { Influencer2PlatformsService } from "./influencer2-platforms.service";
import { Influencer2CampaignsController } from "./influencer2-campaigns.controller";
import { Influencer2CampaignsService } from "./influencer2-campaigns.service";
import { Influencer2FoldersController } from "./influencer2-folders.controller";
import { Influencer2FoldersService } from "./influencer2-folders.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { AuditService } from "../../common/audit.service";

/**
 * Influencer 2 — fully isolated from the existing Influencer/MediaEngagement
 * module (apps/api/src/modules/media/). Nothing here imports from MediaModule
 * and nothing in MediaModule imports from here; the only cross-reference is a
 * plain, unrelated influencerId string validated at the service layer (see
 * Influencer2CampaignsService.resolveInfluencerNames). StorageService comes
 * from the @Global() StorageModule already imported once in app.module.ts —
 * no need to import it again here.
 */
@Module({
  controllers: [Influencer2PlatformsController, Influencer2CampaignsController, Influencer2FoldersController],
  providers: [Influencer2PlatformsService, Influencer2CampaignsService, Influencer2FoldersService, OrgMembershipGuard, AuditService],
  // Exported so PostingAgreementsModule can reuse summary()'s weekly post/engagement
  // aggregation (and now folderAssessment()/Influencer2FoldersService) instead of duplicating it
  // — this is a new third module depending on Influencer2's services, not a
  // MediaModule<->Influencer2Module link, so the isolation note above still holds.
  exports: [Influencer2CampaignsService, Influencer2FoldersService],
})
export class Influencer2Module {}
