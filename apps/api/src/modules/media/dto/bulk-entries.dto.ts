import { IsArray } from "class-validator";
import type { TrackerSubjectType } from "@event-intel/database";

export interface TrackerEntryInput {
  metricId: string;
  subjectType: TrackerSubjectType;
  mediaHostId?: string;
  influencerId?: string;
  numericValue?: number;
  textValue?: string;
  boolValue?: boolean;
}

export class BulkEntriesDto {
  @IsArray()
  entries!: TrackerEntryInput[];
}
