import { IsDateString, IsString, MinLength } from "class-validator";

export class CreateTrackerReportDto {
  @IsString()
  @MinLength(1)
  reportingTimeline!: string;

  @IsDateString()
  paymentDate!: string;

  @IsString()
  @MinLength(1)
  natureOfNarrative!: string;

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
}
