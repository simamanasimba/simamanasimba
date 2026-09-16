import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { PostingAgreementEngagementMetric } from "@event-intel/database";

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

  /** At least one of postsPerWeek or (engagementMetric + engagementTarget) is required — both can
   * be set together, in which case a week only meets requirements when it passes both. */
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
