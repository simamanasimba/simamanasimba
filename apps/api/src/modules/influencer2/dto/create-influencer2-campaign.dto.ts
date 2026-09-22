import { Influencer2CampaignStatus, Influencer2ContentType } from "@event-intel/database";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateInfluencer2CampaignDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsEnum(Influencer2ContentType)
  contentType!: Influencer2ContentType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  contentDate?: string;

  @IsOptional()
  @IsString()
  contentOwner?: string;

  @IsOptional()
  @IsString()
  influencerId?: string;

  @IsOptional()
  @IsString()
  mediaHostId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(Influencer2CampaignStatus)
  status?: Influencer2CampaignStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Which week (per the beneficiary's own posting agreement cycle) this post counts toward —
   * see the schema field comment on Influencer2Campaign.agreementWeekNumber. */
  @IsOptional()
  @IsInt()
  @Min(1)
  agreementWeekNumber?: number;

  /** Which folder ("campaign") this post has been explicitly filed under — see the schema field
   * comment on Influencer2Campaign.folderId. */
  @IsOptional()
  @IsString()
  folderId?: string;
}
