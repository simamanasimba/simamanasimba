import { IsDateString } from "class-validator";

export class EvaluateWeekDto {
  /** The Monday (or any day — service normalizes to a 7-day window from this date) the week starts on. */
  @IsDateString()
  weekStart!: string;
}
