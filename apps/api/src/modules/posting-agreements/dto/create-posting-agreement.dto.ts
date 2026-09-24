import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { PostingAgreementEngagementMetric } from "@event-intel/database";

export class EngagementTargetDto {
  @IsEnum(PostingAgreementEngagementMetric)
  metric!: PostingAgreementEngagementMetric;

  @IsInt()
  @Min(1)
  target!: number;
}

export class CreatePostingAgreementDto {
  @IsOptional()
  @IsString()
  mediaHostId?: string;

  @IsOptional()
  @IsString()
  influencerId?: string;

  /** The day this agreement's weekly cycle begins — week 1 runs startDate..startDate+6, week 2
   * startDate+7..startDate+13, and so on, independent of any other agreement's own calendar. */
  @IsDateString()
  startDate!: string;

  /** At least one of postsPerWeek or engagementTargets is required — both can be set together, in
   * which case a week only meets requirements once every configured check passes. */
  @IsOptional()
  @IsInt()
  @Min(1)
  postsPerWeek?: number;

  /** One entry per metric that must be met (views AND likes AND ..., never OR) — e.g. "4000 views
   * and 500 likes," not a single either/or pick. One entry per metric; the service rejects
   * duplicates. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EngagementTargetDto)
  engagementTargets?: EngagementTargetDto[];

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
