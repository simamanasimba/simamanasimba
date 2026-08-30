"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Influencer, Payment } from "@/lib/types";
import { InfluencerModal } from "@/components/InfluencerModal";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";

function financeTotals(payments: Payment[], influencerId: string) {
  const own = payments.filter((p) => p.influencerId === influencerId);
  const pendingPayments = own.filter((p) => p.status === "PENDING");
  const totalPaid = own.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0);
  return {
    pendingCount: pendingPayments.length,
    pendingAmount: pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    totalPaid,
  };
}

export default function InfluencersPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const isFinance = myRole === "FINANCE_OFFICER";
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Influencer | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["influencers", organizationId],
    queryFn: () => api.get<Influencer[]>(`/api/v1/organizations/${organizationId}/influencers`),
  });
  const { data: payments } = useQuery({
    queryKey: ["payments", organizationId],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments`),
    enabled: isFinance,
  });

  async function onDelete(influencer: Influencer) {
    if (!confirm(`${t("deleteCta")} "${influencer.name}"?`)) return;
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/influencers/${influencer.id}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{t("influencersPageTitle")}</h1>
          <p className="font-display-sub text-sm text-muted">
            {t("influencersPageSubtitle")} · {t("totalInfluencersLabel")}: <span className="nums font-semibold text-ink">{data ? data.length : "—"}</span>
          </p>
        </div>
        {!isFinance && (
          <button className="btn-primary text-sm" onClick={() => setShowNew(true)}>
            <Plus size={15} /> {t("addInfluencer")}
          </button>
        )}
      </div>

      <div className="card hidden overflow-hidden p-0 sm:block">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface text-left text-xs uppercase tracking-wide text-muted">
              {isFinance ? (
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">{t("influencerNameLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("pendingPaymentsColLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("totalPaidColLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("activeColLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("lastUpdatedColLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3" />
                </tr>
              ) : (
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">{t("influencerNameLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("influencerTypeLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("socialHandleLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("phone")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("email")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("campaignLinksLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3" />
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-line">
              {(data ?? []).map((i) => {
                if (isFinance) {
                  const totals = financeTotals(payments ?? [], i.id);
                  return (
                    <tr key={i.id} className="hover:bg-brand-50/40">
                      <td className="px-4 py-3 font-medium text-ink">
                        <Link href={`/org/${organizationId}/influencers/${i.id}`} className="hover:text-brand hover:underline">{i.name}</Link>
                      </td>
                      <td className="nums px-4 py-3 text-muted">{totals.pendingCount > 0 ? `TZS ${totals.pendingAmount.toLocaleString()} (${totals.pendingCount})` : "—"}</td>
                      <td className="nums px-4 py-3 font-medium text-ink">TZS {totals.totalPaid.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${i.isActive === false ? "bg-surface text-muted" : "bg-emerald-50 text-emerald-700"}`}>
                          {i.isActive === false ? t("statusInactiveBadge") : t("statusActiveBadge")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{i.updatedAt ? new Date(i.updatedAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/org/${organizationId}/influencers/${i.id}`} className="text-sm font-semibold text-brand hover:underline">{t("viewLogCta")}</Link>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={i.id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-3 font-medium text-ink">
                      <Link href={`/org/${organizationId}/influencers/${i.id}`} className="hover:text-brand hover:underline">{i.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{i.type}</td>
                    <td className="px-4 py-3 text-muted">{i.socialHandle ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{i.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{i.email ?? "—"}</td>
                    <td className="nums px-4 py-3 text-muted">{i._count?.campaignLinks ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditing(i)} className="text-sm font-semibold text-brand hover:underline">{t("edit")}</button>
                      <button title={t("deleteCta")} onClick={() => onDelete(i)} className="ml-3 text-muted hover:text-red-600"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={isFinance ? 6 : 7} className="px-4 py-6 text-center text-muted">{t("noInfluencersFound")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2.5 sm:hidden">
        {data?.length === 0 && <p className="card text-center text-muted">{t("noInfluencersFound")}</p>}
        {(data ?? []).map((i) => {
          if (isFinance) {
            const totals = financeTotals(payments ?? [], i.id);
            return (
              <Link key={i.id} href={`/org/${organizationId}/influencers/${i.id}`} className="card block">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink hover:text-brand">{i.name}</p>
                  <span className={`badge ${i.isActive === false ? "bg-surface text-muted" : "bg-emerald-50 text-emerald-700"}`}>
                    {i.isActive === false ? t("statusInactiveBadge") : t("statusActiveBadge")}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="nums">{t("pendingPaymentsColLabel")}: {totals.pendingCount > 0 ? `TZS ${totals.pendingAmount.toLocaleString()}` : "—"}</span>
                  <span className="nums">{t("totalPaidColLabel")}: TZS {totals.totalPaid.toLocaleString()}</span>
                </div>
              </Link>
            );
          }
          return (
            <div key={i.id} className="card flex items-start justify-between gap-3">
              <Link href={`/org/${organizationId}/influencers/${i.id}`} className="min-w-0">
                <p className="font-medium text-ink hover:text-brand">{i.name}</p>
                <p className="text-xs text-muted">{i.type} · {i.socialHandle ?? "—"}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>{i.phone ?? "—"}</span>
                  <span>{i.email ?? "—"}</span>
                  <span className="nums">{i._count?.campaignLinks ?? 0} {t("campaignLinksLabel")}</span>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <button onClick={() => setEditing(i)} className="text-sm font-semibold text-brand hover:underline">{t("edit")}</button>
                <button title={t("deleteCta")} onClick={() => onDelete(i)} className="text-muted hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {showNew && (
        <InfluencerModal
          organizationId={organizationId}
          onClose={() => setShowNew(false)}
          onDone={() => { setShowNew(false); refetch(); }}
        />
      )}
      {editing && (
        <InfluencerModal
          organizationId={organizationId}
          influencer={editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); refetch(); }}
        />
      )}
    </div>
  );
}
