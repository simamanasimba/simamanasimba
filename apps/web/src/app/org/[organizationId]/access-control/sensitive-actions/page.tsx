"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert, Undo2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { AuditLogEntry } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import { LoadingWord } from "@/components/LoadingWord";
import { TableSearchInput } from "@/components/TableSearchInput";
import { useLang, type DictKey } from "@/lib/i18n";

const ACTION_LABEL_KEYS: Record<string, DictKey> = {
  "posting_agreement.updated": "sensitiveActionAgreementEdited",
  "posting_agreement.deleted": "sensitiveActionAgreementDeleted",
  "posting_agreement.payment_linked": "sensitiveActionPaymentLinked",
  "payment.edited": "sensitiveActionPaymentEdited",
  "payment.undone": "sensitiveActionPaymentUndone",
  "payment.redone": "sensitiveActionPaymentRedone",
};

/** "Action Access Control": the on-demand review list for the sensitive, Super-Admin-only,
 * reason-required actions (edit/delete a posting agreement, edit/undo/redo a payment) — see each
 * action's own backend route for the lockdown, and AuditLogsController.listSensitive for how this
 * is just the general audit log filtered to those action names. Not part of the toggleable
 * permission-area system: this page and its endpoint are Super Admin only, always. A
 * "payment.undone" row gets its own Redo action right here — reversing that exact undo (see
 * PaymentsService.redoUndoPayment) without having to go find the payment itself first. */
export default function SensitiveActionsLogPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [redoingId, setRedoingId] = useState<string | null>(null);

  const { data: entries, refetch } = useQuery({
    queryKey: ["sensitive-actions", organizationId],
    queryFn: () => api.get<AuditLogEntry[]>(`/api/v1/organizations/${organizationId}/audit-logs/sensitive-actions`),
    enabled: myRole === "ORG_SUPER_ADMIN",
  });

  async function onRedo(entry: AuditLogEntry) {
    if (!entry.entityId) return;
    const reason = window.prompt(t("redoPaymentReasonPrompt"));
    if (!reason?.trim()) return;
    setRedoingId(entry.id);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/payments/${entry.entityId}/redo`, { auditLogId: entry.id, reason: reason.trim() });
      showToast("success", t("redoPaymentSuccess"));
      await refetch();
      queryClient.invalidateQueries({ predicate: (q) => ["payments", "finance-dashboard", "conditional-payments"].includes(q.queryKey[0] as string) });
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("redoPaymentFailed"));
    } finally {
      setRedoingId(null);
    }
  }

  /** Payment-related entries (edited/undone/redone) carry who it was for, how much, and what it
   * was described as (usually "Posting agreement — Week N" for a posting-agreement payment) — see
   * PaymentsService.describeBeneficiary and the metadata each of those three controller routes
   * records. Agreement entries don't have this, so the cell just reads "—" for them. */
  function paymentDetails(e: AuditLogEntry): string | null {
    if (!["payment.edited", "payment.undone", "payment.redone"].includes(e.action)) return null;
    const m = e.metadata;
    const beneficiaryName = typeof m?.beneficiaryName === "string" ? m.beneficiaryName : "—";
    const currency = typeof m?.currency === "string" ? m.currency : "";
    const amount = typeof m?.paidAmount === "number" ? m.paidAmount : typeof m?.amount === "number" ? m.amount : null;
    const description = typeof m?.description === "string" && m.description ? m.description : null;
    const parts = [beneficiaryName, amount != null ? `${currency} ${amount.toLocaleString()}`.trim() : null, description].filter(Boolean);
    return parts.join(" · ");
  }

  const filtered = useMemo(() => {
    const rows = entries ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e) => {
      const actorName = e.user ? `${e.user.firstName} ${e.user.lastName}` : "";
      const reason = typeof e.metadata?.reason === "string" ? e.metadata.reason : "";
      const beneficiaryName = typeof e.metadata?.beneficiaryName === "string" ? e.metadata.beneficiaryName : "";
      return [actorName, e.user?.email, reason, e.action, e.entityId, beneficiaryName].some((f) => (f ?? "").toLowerCase().includes(q));
    });
  }, [entries, search]);

  if (myRole !== undefined && myRole !== "ORG_SUPER_ADMIN") {
    return (
      <div className="card">
        <p className="text-sm text-muted">{t("superAdminOnlyMessage")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href={`/org/${organizationId}/access-control`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
        <ArrowLeft size={15} /> {t("backToListCta")}
      </Link>

      <div className="flex items-center gap-2">
        <ShieldAlert size={20} className="text-warning" />
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{t("sensitiveActionsLogTitle")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("sensitiveActionsLogHint")}</p>
        </div>
      </div>

      {!entries ? (
        <LoadingWord />
      ) : entries.length === 0 ? (
        <p className="card text-muted">{t("sensitiveActionsLogEmpty")}</p>
      ) : (
        <>
          <TableSearchInput value={search} onChange={setSearch} placeholder={t("searchGenericPlaceholder")} />
          {filtered.length === 0 ? (
            <p className="card text-muted">{t("noSearchResults")}</p>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5">{t("dateLabel")}</th>
                    <th className="px-4 py-2.5">{t("actionColLabel")}</th>
                    <th className="px-4 py-2.5">{t("actorColLabel")}</th>
                    <th className="px-4 py-2.5">{t("paymentDetailsColLabel")}</th>
                    <th className="px-4 py-2.5">{t("reasonColLabel")}</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((e) => (
                    <tr key={e.id} className="align-top hover:bg-brand-50/40">
                      <td className="px-4 py-2.5 text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">{t(ACTION_LABEL_KEYS[e.action] ?? "sensitiveActionAgreementEdited")}</td>
                      <td className="px-4 py-2.5 text-ink">{e.user ? `${e.user.firstName} ${e.user.lastName}` : "—"}</td>
                      <td className="max-w-xs px-4 py-2.5 text-ink">{paymentDetails(e) ?? "—"}</td>
                      <td className="max-w-md px-4 py-2.5 text-ink">{typeof e.metadata?.reason === "string" ? e.metadata.reason : "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {e.action === "payment.undone" && (
                          <button
                            type="button"
                            className="btn-secondary !py-1 text-xs"
                            disabled={redoingId === e.id}
                            onClick={() => onRedo(e)}
                          >
                            <Undo2 size={13} /> {redoingId === e.id ? t("saving") : t("redoCta")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
