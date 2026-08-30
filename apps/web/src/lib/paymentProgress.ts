import type { DictKey } from "@/lib/i18n";

export type PaymentProgress = "UNPAID" | "PENDING_PAYMENT" | "PAID";

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
