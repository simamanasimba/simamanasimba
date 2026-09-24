import { IsString, MinLength } from "class-validator";

/** Reconciliation action — Super Admin only. A payment for this beneficiary was already recorded
 * OUTSIDE the normal mark-paid flow (e.g. a general/bulk payment made before Campaign Weeks
 * existed, or one that never named a specific week) — this links it to the week/campaign it
 * actually covers, so that week stops showing as "Awaiting Finance" even though it was genuinely
 * already paid. Never creates a new payment; the money is already recorded and already counted in
 * every spend total, only the link was missing. */
export class LinkExistingPaymentDto {
  @IsString()
  paymentId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}
