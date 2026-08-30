import { PartialType } from "@nestjs/mapped-types";
import { CreateMediaHostDto } from "./create-media-host.dto";

export class UpdateMediaHostDto extends PartialType(CreateMediaHostDto) {}
