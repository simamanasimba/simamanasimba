import { IsString, MinLength } from "class-validator";

/** Super Admin's "Redo" action from the Sensitive Actions Log — reverses one specific
 * undoPayment() call, identified by that exact audit log entry (not just "the latest undo for
 * this payment"), so repeated undo/redo cycles over time each resolve unambiguously. Always
 * requires a stated reason, same as every other Action Access Control action. */
export class RedoPaymentDto {
  @IsString()
  auditLogId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}
