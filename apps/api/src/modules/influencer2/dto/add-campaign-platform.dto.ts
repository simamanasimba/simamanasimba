import { IsDateString, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

export class AddCampaignPlatformDto {
  @IsString()
  @MinLength(1)
  platformId!: string;

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
