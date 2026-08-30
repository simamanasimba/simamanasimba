import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { MetricFieldType } from "@event-intel/database";

export class CreateTrackerMetricDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(MetricFieldType)
  fieldType?: MetricFieldType;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  scoringEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsNumber()
  minValue?: number;

  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @IsOptional()
  @IsNumber()
  target?: number;

  @IsOptional()
  @IsString()
  calculationMethod?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
