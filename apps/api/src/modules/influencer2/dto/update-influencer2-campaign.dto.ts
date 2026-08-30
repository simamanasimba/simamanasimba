import { PartialType } from "@nestjs/mapped-types";
import { CreateInfluencer2CampaignDto } from "./create-influencer2-campaign.dto";

export class UpdateInfluencer2CampaignDto extends PartialType(CreateInfluencer2CampaignDto) {}
