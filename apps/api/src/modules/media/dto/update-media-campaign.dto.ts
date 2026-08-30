import { PartialType } from "@nestjs/mapped-types";
import { CreateMediaCampaignDto } from "./create-media-campaign.dto";

export class UpdateMediaCampaignDto extends PartialType(CreateMediaCampaignDto) {}
