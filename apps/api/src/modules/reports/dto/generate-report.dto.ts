import { IsEnum, IsObject, IsOptional } from "class-validator";
import { ReportFormat, ReportType } from "@event-intel/database";

export class GenerateReportDto {
  @IsEnum(ReportType)
  type!: ReportType;

  @IsEnum(ReportFormat)
  format!: ReportFormat;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}
