import { IsDateString, IsOptional } from "class-validator";

export class CreateSessionDto {
  /** Defaults to today when omitted. */
  @IsOptional()
  @IsDateString()
  sessionDate?: string;
}
