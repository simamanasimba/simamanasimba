"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MediaHost, Payment } from "@/lib/types";
import { MediaHostModal } from "@/components/MediaHostModal";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";

function financeTotals(payments: Payment[], mediaHostId: string) {
  const own = payments.filter((p) => p.mediaHostId === mediaHostId);
  const pendingPayments = own.filter((p) => p.status === "PENDING");
  const totalPaid = own.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0);
  return {
    pendingCount: pendingPayments.length,
    pendingAmount: pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    totalPaid,
  };
}

export default function MediaHostsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const isFinance = myRole === "FINANCE_OFFICER";
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<MediaHost | null>(null);

  const { data: allHosts, refetch } = useQuery({
    queryKey: ["media-hosts", organizationId],
    queryFn: () => api.get<MediaHost[]>(`/api/v1/organizations/${organizationId}/media-hosts`),
  });
  const { data: payments } = useQuery({
    queryKey: ["payments", organizationId],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments`),
    enabled: isFinance,
  });

  // Only hosts actually registered through the Media/Channel/Session flow — older hosts that
  // predate that flow (no mediaOutletId set) have nothing meaningful to show in those columns
  // and are left out of this list on purpose. Finance keeps seeing every host regardless, since
  // they may still need to pay one of those older hosts.
  const data = isFinance ? allHosts : allHosts?.filter((h) => h.mediaOutletId);
  const uniqueMediaCount = new Set((data ?? []).filter((h) => h.mediaOutletId).map((h) => h.mediaOutletId)).size;

  async function onDelete(host: MediaHost) {
    if (!confirm(`${t("deleteCta")} "${host.name}"?`)) return;
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/media-hosts/${host.id}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{t("mediaHostsPageTitle")}</h1>
          <p className="font-display-sub text-sm text-muted">
            {t("mediaHostsPageSubtitle")} · {t("activeMediaLabel")}: <span className="nums font-semibold text-ink">{data ? uniqueMediaCount : "—"}</span> · {t("totalMediaHostsLabel")}: <span className="nums font-semibold text-ink">{data ? data.length : "—"}</span>
          </p>
        </div>
        {!isFinance && (
          <button className="btn-primary text-sm" onClick={() => setShowNew(true)}>
            <Plus size={15} /> {t("addMediaHost")}
          </button>
        )}
      </div>

      <div className="card hidden overflow-hidden p-0 sm:block">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface text-left text-xs uppercase tracking-wide text-muted">
              {isFinance ? (
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">{t("hostNameLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("pendingPaymentsColLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("totalPaidColLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("activeColLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("lastUpdatedColLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3" />
                </tr>
              ) : (
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">{t("hostNameLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("mediaOutletLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("mediaChannelLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("mediaSessionLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3" title={t("allTimeTotalHint")}>{t("campaignsColLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("addedLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-3" />
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-line">
              {(data ?? []).map((h) => {
                if (isFinance) {
                  const totals = financeTotals(payments ?? [], h.id);
                  return (
                    <tr key={h.id} className="hover:bg-brand-50/40">
                      <td className="px-4 py-3 font-medium text-ink">
                        <Link href={`/org/${organizationId}/media-hosts/${h.id}`} className="hover:text-brand hover:underline">{h.name}</Link>
                      </td>
                      <td className="nums px-4 py-3 text-muted">{totals.pendingCount > 0 ? `TZS ${totals.pendingAmount.toLocaleString()} (${totals.pendingCount})` : "—"}</td>
                      <td className="nums px-4 py-3 font-medium text-ink">TZS {totals.totalPaid.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${h.isActive === false ? "bg-surface text-muted" : "bg-emerald-50 text-emerald-700"}`}>
                          {h.isActive === false ? t("statusInactiveBadge") : t("statusActiveBadge")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{h.updatedAt ? new Date(h.updatedAt).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/org/${organizationId}/media-hosts/${h.id}`} className="text-sm font-semibold text-brand hover:underline">{t("viewLogCta")}</Link>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={h.id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-3 font-medium text-ink">
                      <Link href={`/org/${organizationId}/media-hosts/${h.id}`} className="hover:text-brand hover:underline">{h.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{h.mediaOutlet?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{h.channelName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{h.programName ?? "—"}</td>
                    <td className="nums px-4 py-3 text-muted">{h.campaignCount ?? 0}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditing(h)} className="text-sm font-semibold text-brand hover:underline">{t("edit")}</button>
                      <button title={t("deleteCta")} onClick={() => onDelete(h)} className="ml-3 text-muted hover:text-red-600"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={isFinance ? 6 : 7} className="px-4 py-6 text-center text-muted">{t("noMediaHostsFound")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2.5 sm:hidden">
        {data?.length === 0 && <p className="card text-center text-muted">{t("noMediaHostsFound")}</p>}
        {(data ?? []).map((h) => {
          if (isFinance) {
            const totals = financeTotals(payments ?? [], h.id);
            return (
              <Link key={h.id} href={`/org/${organizationId}/media-hosts/${h.id}`} className="card block">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink hover:text-brand">{h.name}</p>
                  <span className={`badge ${h.isActive === false ? "bg-surface text-muted" : "bg-emerald-50 text-emerald-700"}`}>
                    {h.isActive === false ? t("statusInactiveBadge") : t("statusActiveBadge")}
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
            <div key={h.id} className="card flex items-start justify-between gap-3">
              <Link href={`/org/${organizationId}/media-hosts/${h.id}`} className="min-w-0">
                <p className="font-medium text-ink hover:text-brand">{h.name}</p>
                <p className="text-xs text-muted">{[h.mediaOutlet?.name, h.channelName, h.programName].filter(Boolean).join(" · ") || h.type}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="nums">{h.campaignCount ?? 0} {t("campaignsColLabel")}</span>
                  {h.createdAt && <span>{t("addedLabel")}: {new Date(h.createdAt).toLocaleDateString()}</span>}
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <button onClick={() => setEditing(h)} className="text-sm font-semibold text-brand hover:underline">{t("edit")}</button>
                <button title={t("deleteCta")} onClick={() => onDelete(h)} className="text-muted hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {showNew && (
        <MediaHostModal
          organizationId={organizationId}
          onClose={() => setShowNew(false)}
          onDone={() => { setShowNew(false); refetch(); }}
        />
      )}
      {editing && (
        <MediaHostModal
          organizationId={organizationId}
          mediaHost={editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); refetch(); }}
        />
      )}
    </div>
  );
}
