import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, MinLength, ValidateNested } from "class-validator";

export class MetricEntryDto {
  @IsString()
  @MinLength(1)
  metricDefinitionId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number;
}

export class SubmitMetricsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MetricEntryDto)
  metrics!: MetricEntryDto[];
}
