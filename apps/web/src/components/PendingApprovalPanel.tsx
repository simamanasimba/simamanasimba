"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, ExternalLink } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useLang } from "@/lib/i18n";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import type { Payment } from "@/lib/types";

interface OrgUserRow {
  userId: string;
  role: string;
  status: string;
  user: { firstName: string; lastName: string };
}

const ADMIN_ROLES = ["ORG_SUPER_ADMIN", "ORG_ADMIN"];

/** Resolves the real names of whoever can currently approve a payment — the baseline admin
 * roles, plus anyone whose role an admin has additively granted the "payment-approval" area
 * to from Access Control — so it's never just a role label, always actual people. */
function ApproversLine({ organizationId }: { organizationId: string }) {
  const { t } = useLang();
  const { data: perms } = useRolePermissions(organizationId);
  const { data: users } = useQuery({
    queryKey: ["org-users", organizationId],
    queryFn: () => api.get<OrgUserRow[]>(`/api/v1/organizations/${organizationId}/users`),
  });
  const approvalMatrix = perms?.matrix?.["payment-approval"]?.edit;
  const canRoleApprove = (role: string) => (approvalMatrix?.[role as keyof typeof approvalMatrix]?.allowed ?? ADMIN_ROLES.includes(role));
  const approvers = (users ?? []).filter((u) => u.status === "ACTIVE" && canRoleApprove(u.role));

  if (approvers.length === 0) return null;
  return (
    <p className="text-xs text-muted">
      {t("approversLabel")}: {approvers.map((a) => `${a.user.firstName} ${a.user.lastName}`).join(", ")}
    </p>
  );
}

/** New campaign payments always start PENDING (see PaymentsService.create) — this is where
 * whoever has the "payment-approval" area (Super Admin/Admin by default, or an additively
 * granted role) approves or rejects them. One click: Approve marks a payment PAID directly (and
 * flips the linked campaign to paid) — no separate in-between stage. Lives on the Finance
 * Reports page rather than the operational Finance page since that page is Finance-Officer-only
 * and admins couldn't reach it otherwise. */
export function PendingApprovalPanel({ organizationId }: { organizationId: string }) {
  const showPageHref = (p: Payment) =>
    p.influencerId ? `/org/${organizationId}/influencers/${p.influencerId}` : p.mediaHostId ? `/org/${organizationId}/media-hosts/${p.mediaHostId}` : null;
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [actingId, setActingId] = useState<string | null>(null);

  const { data: pending } = useQuery({
    queryKey: ["payments", organizationId, "PENDING"],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments?status=PENDING`),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["payments", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["finance-dashboard", organizationId] });
  }

  async function approve(paymentId: string) {
    setActingId(paymentId);
    try {
      await api.patch(`/api/v1/organizations/${organizationId}/payments/${paymentId}/approve`, {});
      showToast("success", t("paymentApprovedToast"));
      refresh();
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedApprovePayment"));
    } finally {
      setActingId(null);
    }
  }

  async function reject(paymentId: string) {
    if (!confirm(t("confirmRejectPayment"))) return;
    setActingId(paymentId);
    try {
      await api.patch(`/api/v1/organizations/${organizationId}/payments/${paymentId}/reject`, {});
      showToast("success", t("paymentRejectedToast"));
      refresh();
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedRejectPayment"));
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{t("pendingApprovalTitle")}</h2>
        <p className="text-xs text-muted">{t("pendingApprovalHelp")}</p>
        <ApproversLine organizationId={organizationId} />
      </div>
      {(pending?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted">{t("noPendingApprovalPayments")}</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5">{t("beneficiaryLabel")}</th>
                <th className="whitespace-nowrap px-4 py-2.5">{t("amountLabel")}</th>
                <th className="whitespace-nowrap px-4 py-2.5">{t("paidByLabel")}</th>
                <th className="whitespace-nowrap px-4 py-2.5">{t("campaignColLabel")}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(pending ?? []).map((p) => {
                const href = showPageHref(p);
                return (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    {href ? (
                      <Link href={href} className="hover:underline">{p.mediaHost?.name ?? p.influencer?.name ?? "—"}</Link>
                    ) : (
                      p.mediaHost?.name ?? p.influencer?.name ?? "—"
                    )}
                  </td>
                  <td className="nums px-4 py-2.5">{p.currency} {p.amount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-muted">{p.createdByName ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {p.influencer2CampaignId ? (
                      <Link
                        href={`/org/${organizationId}/influencer2/${p.influencer2CampaignId}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                      >
                        {t("inspectCampaignCta")} <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button disabled={actingId === p.id} onClick={() => approve(p.id)} title={t("approveCta")} className="btn-primary !p-2"><Check size={14} /></button>
                      <button disabled={actingId === p.id} onClick={() => reject(p.id)} title={t("rejectCta")} className="btn-secondary !p-2"><X size={14} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
