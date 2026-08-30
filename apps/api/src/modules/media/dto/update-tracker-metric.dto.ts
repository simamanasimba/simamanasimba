import { PartialType } from "@nestjs/mapped-types";
import { CreateTrackerMetricDto } from "./create-tracker-metric.dto";

export class UpdateTrackerMetricDto extends PartialType(CreateTrackerMetricDto) {}
