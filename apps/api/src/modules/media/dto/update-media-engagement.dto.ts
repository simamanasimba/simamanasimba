import { PartialType } from "@nestjs/mapped-types";
import { CreateMediaEngagementDto } from "./create-media-engagement.dto";

export class UpdateMediaEngagementDto extends PartialType(CreateMediaEngagementDto) {}
