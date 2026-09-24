import { IsString, MinLength } from "class-validator";

/** Sensitive action — Super Admin only (see PostingAgreementsController.remove). Sent as a DELETE
 * request body; always required so there's a stated reason on record, flagged for review. */
export class RemovePostingAgreementDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
