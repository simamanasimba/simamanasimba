import { ArrayMinSize, IsArray, IsInt, IsString, Min } from "class-validator";

export class BulkAssignWeekDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  campaignIds!: string[];

  @IsInt()
  @Min(1)
  weekNumber!: number;
}
