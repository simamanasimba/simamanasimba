import { IsString, MinLength } from "class-validator";

/** Super Admin's "this shouldn't have been recorded" action — reverses a payment (including an
 * already-PAID one) to CANCELLED. Always requires a stated reason, same as EditPaymentDto. */
export class UndoPaymentDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
