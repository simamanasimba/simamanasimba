import type { DictKey } from "@/lib/i18n";
import type { Payment } from "@/lib/types";

export type PaymentProgress = "UNPAID" | "PENDING_PAYMENT" | "PAID";

/** Every payment beneficiary display in the app reads this instead of duplicating the
 * mediaHost/influencer/member fallback chain — Member has no single `name` field like
 * MediaHost/Influencer do, so this is also where that gets composed. */
export function paymentBeneficiaryName(p: Payment): string {
  return p.mediaHost?.name ?? p.influencer?.name ?? (p.member ? `${p.member.firstName} ${p.member.lastName}` : null) ?? "—";
}

export const PAYMENT_PROGRESS_LABEL_KEYS: Record<PaymentProgress, DictKey> = {
  UNPAID: "paymentStatusUnpaid",
  PENDING_PAYMENT: "paymentStatusPendingPayment",
  PAID: "paymentStatusPaid",
};

export const PAYMENT_PROGRESS_BADGE: Record<PaymentProgress, string> = {
  UNPAID: "bg-amber-50 text-warning",
  PENDING_PAYMENT: "bg-blue-50 text-info",
  PAID: "bg-green-50 text-success",
};
