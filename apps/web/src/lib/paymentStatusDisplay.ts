import type { DictKey } from "@/lib/i18n";
import type { Payment } from "@/lib/types";

export const PAYMENT_STATUS_LABEL_KEYS: Record<Payment["status"], DictKey> = {
  PENDING: "paymentStatusUnpaid",
  PROCESSING: "paymentStatusPendingPayment",
  PAID: "paymentStatusPaid",
  REJECTED: "statusRejected",
  CANCELLED: "statusCancelled",
};

export const PAYMENT_STATUS_BADGE: Record<Payment["status"], string> = {
  PENDING: "bg-amber-50 text-warning",
  PROCESSING: "bg-blue-50 text-info",
  PAID: "bg-green-50 text-success",
  REJECTED: "bg-brand-50 text-brand-700",
  CANCELLED: "bg-surface text-muted",
};
