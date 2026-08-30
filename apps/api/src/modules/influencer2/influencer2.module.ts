import { Module } from "@nestjs/common";
import { Influencer2PlatformsController } from "./influencer2-platforms.controller";
import { Influencer2PlatformsService } from "./influencer2-platforms.service";
import { Influencer2CampaignsController } from "./influencer2-campaigns.controller";
import { Influencer2CampaignsService } from "./influencer2-campaigns.service";
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
  controllers: [Influencer2PlatformsController, Influencer2CampaignsController],
  providers: [Influencer2PlatformsService, Influencer2CampaignsService, OrgMembershipGuard, AuditService],
})
export class Influencer2Module {}
