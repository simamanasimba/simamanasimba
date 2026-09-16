import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsOptional } from "class-validator";
import { CreatePostingAgreementDto } from "./create-posting-agreement.dto";

export class UpdatePostingAgreementDto extends PartialType(CreatePostingAgreementDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
