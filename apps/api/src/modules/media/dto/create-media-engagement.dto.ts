import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateMediaEngagementDto {
  @IsString()
  @MinLength(1)
  topicPostAgenda!: string;

  @IsString()
  @MinLength(1)
  narrativeKeyMessage!: string;

  @IsString()
  @MinLength(1)
  reachAudience!: string;

  @IsString()
  @MinLength(1)
  memberEngagement!: string;

  @IsString()
  @MinLength(1)
  mediaImpactOutcome!: string;

  @IsString()
  @MinLength(1)
  regionalFeedback!: string;

  @IsString()
  @MinLength(1)
  meNotes!: string;

  @IsString()
  @MinLength(1)
  natureOfNarrative!: string;

  @IsString()
  @MinLength(1)
  reportingTimeline!: string;

  @IsString()
  @MinLength(1)
  link!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  likes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  comments?: number;
}
