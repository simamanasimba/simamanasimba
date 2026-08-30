import { Influencer2CampaignStatus, Influencer2ContentType } from "@event-intel/database";
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

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
}
