import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { CreatePostingAgreementDto } from "./create-posting-agreement.dto";

export class UpdatePostingAgreementDto extends PartialType(CreatePostingAgreementDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Sensitive action — Super Admin only (see PostingAgreementsController.update). Always
   * required so there's a stated reason on record for every edit, flagged for review. */
  @IsString()
  @MinLength(3)
  reason!: string;
}
