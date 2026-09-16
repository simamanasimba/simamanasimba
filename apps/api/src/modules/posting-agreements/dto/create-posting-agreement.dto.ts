import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { PostingAgreementEngagementMetric, PostingAgreementTargetType } from "@event-intel/database";

export class CreatePostingAgreementDto {
  @IsOptional()
  @IsString()
  mediaHostId?: string;

  @IsOptional()
  @IsString()
  influencerId?: string;

  @IsEnum(PostingAgreementTargetType)
  targetType!: PostingAgreementTargetType;

  @IsOptional()
  @IsInt()
  @Min(1)
  postsPerWeek?: number;

  @IsOptional()
  @IsEnum(PostingAgreementEngagementMetric)
  engagementMetric?: PostingAgreementEngagementMetric;

  @IsOptional()
  @IsInt()
  @Min(1)
  engagementTarget?: number;

  @IsNumber()
  @Min(0)
  weeklyAmount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
