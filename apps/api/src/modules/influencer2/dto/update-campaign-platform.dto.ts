import { IsDateString, IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateCampaignPlatformDto {
  @IsOptional()
  @IsUrl()
  postUrl?: string;

  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
