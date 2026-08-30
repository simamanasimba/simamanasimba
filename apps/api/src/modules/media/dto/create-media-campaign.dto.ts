import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { MediaCampaignStatus } from "@event-intel/database";

export class CreateMediaCampaignDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  campaignType?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(MediaCampaignStatus)
  status?: MediaCampaignStatus;

  @IsOptional()
  @IsNumber()
  budget?: number;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
