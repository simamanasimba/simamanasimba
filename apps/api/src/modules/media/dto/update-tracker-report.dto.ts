import { PartialType } from "@nestjs/mapped-types";
import { CreateTrackerReportDto } from "./create-tracker-report.dto";

export class UpdateTrackerReportDto extends PartialType(CreateTrackerReportDto) {}
