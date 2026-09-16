"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Star, Radio, Crown, Download } from "lucide-react";
import { api } from "@/lib/api";
import type { Payment, MediaHost, Influencer, PaginatedMembers } from "@/lib/types";
import { escapeCsv, downloadCsv } from "@/lib/csv";
import { useLang } from "@/lib/i18n";
import { PAYMENT_STATUS_LABEL_KEYS as STATUS_LABEL_KEYS, PAYMENT_STATUS_BADGE as STATUS_BADGE } from "@/lib/paymentStatusDisplay";
import { paymentBeneficiaryName } from "@/lib/paymentProgress";

function paymentsToCsv(rows: Payment[]): string {
  const header = ["Date", "Beneficiary Type", "Name", "Amount", "Currency", "Method", "Reference", "Status", "Approved By", "Approved On"];
  const lines = [header.map(escapeCsv).join(",")];
  for (const p of rows) {
    const name = paymentBeneficiaryName(p);
    lines.push(
      [
        new Date(p.paymentDate).toLocaleDateString(),
        p.beneficiaryType,
        name,
        p.amount,
        p.currency,
        p.method ?? "",
        p.bankTransactionRef ?? p.mobileMoneyTransactionId ?? p.referenceNumber ?? "",
        p.status,
        p.approvedByName ?? "",
        p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : "",
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  return lines.join("\n");
}

/** Full payment transaction log, one tab per module (Influencers / Media hosts) — each tab starts
 * with its own filters (date range + a specific person of that type) above its own table, so the
 * two modules never get mixed together the way a single combined table used to. */
export function TransactionLogTabs({ organizationId }: { organizationId: string }) {
  const { t } = useLang();
  const [tab, setTab] = useState<"INFLUENCER" | "MEDIA_HOST" | "MEMBER">("INFLUENCER");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPersonId, setFilterPersonId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: payments } = useQuery({
    queryKey: ["payments", organizationId],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments`),
  });
  const { data: hosts } = useQuery({ queryKey: ["media-hosts", organizationId], queryFn: () => api.get<MediaHost[]>(`/api/v1/organizations/${organizationId}/media-hosts`) });
  const { data: influencers } = useQuery({ queryKey: ["influencers", organizationId], queryFn: () => api.get<Influencer[]>(`/api/v1/organizations/${organizationId}/influencers`) });
  const { data: leaders } = useQuery({
    queryKey: ["members-leaders", organizationId],
    queryFn: () => api.get<PaginatedMembers>(`/api/v1/organizations/${organizationId}/members?isLeader=true&pageSize=500`),
  });

  const peopleForTab: Array<{ id: string; name: string }> =
    tab === "INFLUENCER" ? influencers ?? [] : tab === "MEDIA_HOST" ? hosts ?? [] : (leaders?.items ?? []).map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}` }));

  function switchTab(next: "INFLUENCER" | "MEDIA_HOST" | "MEMBER") {
    setTab(next);
    setFilterPersonId("");
    setSelected(new Set());
  }

  const filteredPayments = useMemo(() => {
    return (payments ?? []).filter((p) => {
      if (p.beneficiaryType !== tab) return false;
      const date = p.paymentDate.slice(0, 10);
      if (filterDateFrom && date < filterDateFrom) return false;
      if (filterDateTo && date > filterDateTo) return false;
      if (filterPersonId) {
        if (tab === "INFLUENCER" && p.influencerId !== filterPersonId) return false;
        if (tab === "MEDIA_HOST" && p.mediaHostId !== filterPersonId) return false;
        if (tab === "MEMBER" && p.memberId !== filterPersonId) return false;
      }
      return true;
    });
  }, [payments, tab, filterDateFrom, filterDateTo, filterPersonId]);

  const filteredTotal = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const allSelected = filteredPayments.length > 0 && filteredPayments.every((p) => selected.has(p.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filteredPayments.map((p) => p.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportAll() {
    downloadCsv(`${tab.toLowerCase()}-payments-${new Date().toISOString().slice(0, 10)}.csv`, paymentsToCsv(filteredPayments));
  }
  function exportSelected() {
    downloadCsv(`${tab.toLowerCase()}-payments-selected-${new Date().toISOString().slice(0, 10)}.csv`, paymentsToCsv(filteredPayments.filter((p) => selected.has(p.id))));
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-xl bg-surface p-1">
        <button
          onClick={() => switchTab("INFLUENCER")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${tab === "INFLUENCER" ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`}
        >
          <Star size={14} /> {t("navInfluencers")}
        </button>
        <button
          onClick={() => switchTab("MEDIA_HOST")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${tab === "MEDIA_HOST" ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`}
        >
          <Radio size={14} /> {t("navMediaHosts")}
        </button>
        <button
          onClick={() => switchTab("MEMBER")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${tab === "MEMBER" ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`}
        >
          <Crown size={14} /> {t("tabLeaders")}
        </button>
      </div>

      <div className="card space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="label">{t("filterByDateLabel")}</label>
            <div className="flex items-center gap-2">
              <input type="date" className="input" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
              <span className="text-muted">–</span>
              <input type="date" className="input" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">{t("filterByPersonLabel")}</label>
            <select className="input" value={filterPersonId} onChange={(e) => setFilterPersonId(e.target.value)}>
              <option value="">{t("allPeopleOption")}</option>
              {peopleForTab.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            {(filterDateFrom || filterDateTo || filterPersonId) && (
              <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterPersonId(""); }} className="btn-secondary text-sm">
                {t("clearFiltersCta")}
              </button>
            )}
          </div>
          <div className="flex flex-col items-end justify-end">
            <span className="text-xs text-muted">{t("filteredTotalLabel")}</span>
            <span className="nums text-lg font-bold text-ink">{filteredPayments[0]?.currency ?? "TZS"} {filteredTotal.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-line pt-4">
          <button onClick={exportAll} disabled={filteredPayments.length === 0} className="btn-primary text-sm disabled:opacity-40">
            <Download size={14} /> {t("exportAllCta")} ({filteredPayments.length})
          </button>
          <button onClick={exportSelected} disabled={selected.size === 0} className="btn-secondary text-sm disabled:opacity-40">
            <Download size={14} /> {t("exportSelectedCta")} ({selected.size})
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {filteredPayments.length === 0 ? (
          <p className="p-5 text-muted">{t("noPaymentHistoryYet")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-line" />
                  </th>
                  <th className="px-4 py-2.5">{t("paymentDateLabel")}</th>
                  <th className="px-4 py-2.5">{t("colName")}</th>
                  <th className="px-4 py-2.5">{t("amountLabel")}</th>
                  <th className="px-4 py-2.5">{t("paymentMethodLabel")}</th>
                  <th className="px-4 py-2.5">{t("paymentStatusLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-2.5">{t("approvedByLabel")}</th>
                  <th className="whitespace-nowrap px-4 py-2.5">{t("approvedAtLabel")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className={selected.has(p.id) ? "bg-brand-50/40" : undefined}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="h-4 w-4 rounded border-line" />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink">{new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-ink">
                      {(() => {
                        const href = p.influencerId
                          ? `/org/${organizationId}/influencers/${p.influencerId}`
                          : p.mediaHostId
                            ? `/org/${organizationId}/media-hosts/${p.mediaHostId}`
                            : p.memberId
                              ? `/org/${organizationId}/members/${p.memberId}`
                              : null;
                        const name = paymentBeneficiaryName(p);
                        return href ? <Link href={href} className="font-medium hover:underline">{name}</Link> : name;
                      })()}
                    </td>
                    <td className="nums px-4 py-2.5">
                      {p.currency} {p.amount.toLocaleString()}
                      {p.paidAmount != null && p.paidAmount !== p.amount && (
                        <span className="ml-1 text-xs text-muted" title={p.amountVarianceNote ?? undefined}>
                          ({t("paidAmountLabel")}: {p.paidAmount.toLocaleString()})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{p.method ?? "—"}</td>
                    <td className="px-4 py-2.5"><span className={`badge ${STATUS_BADGE[p.status]}`}>{t(STATUS_LABEL_KEYS[p.status])}</span></td>
                    <td className="px-4 py-2.5 text-muted">{p.approvedByName ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">{p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
