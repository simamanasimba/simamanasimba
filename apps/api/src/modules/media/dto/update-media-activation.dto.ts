import { PartialType } from "@nestjs/mapped-types";
import { CreateMediaActivationDto } from "./create-media-activation.dto";

export class UpdateMediaActivationDto extends PartialType(CreateMediaActivationDto) {}
