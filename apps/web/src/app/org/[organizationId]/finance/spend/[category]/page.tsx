"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { api } from "@/lib/api";
import type { FinanceDashboard } from "@/lib/types";
import { RequireAccess } from "@/components/RequireAccess";
import { LoadingWord } from "@/components/LoadingWord";
import { TableSearchInput } from "@/components/TableSearchInput";
import { escapeCsv, downloadCsv } from "@/lib/csv";
import { useLang, type DictKey } from "@/lib/i18n";

type SpendCategory = "media" | "influencer" | "member" | "meeting";

const TITLE_KEY: Record<SpendCategory, DictKey> = {
  media: "mediaSpendLabel",
  influencer: "influencerSpendLabel",
  member: "leaderSpendLabel",
  meeting: "meetingCostsLabel",
};

interface Row {
  id: string;
  name: string;
  amount: number;
}

/** The full-page "what actually made up that number" drill-down behind a Finance spend tile —
 * a real page rather than a popup, since Finance needs to review and export these for auditing,
 * not just glance at them. Highest first, each row linking straight to that one beneficiary's own
 * payment history (or, for a meeting, its own event page). */
export default function SpendDetailPage() {
  const { organizationId, category } = useParams<{ organizationId: string; category: SpendCategory }>();
  const { t } = useLang();

  const { data: dashboard } = useQuery({
    queryKey: ["finance-dashboard", organizationId],
    queryFn: () => api.get<FinanceDashboard>(`/api/v1/organizations/${organizationId}/payments/finance-dashboard`),
  });

  const rows: Row[] = useMemo(() => {
    if (!dashboard) return [];
    switch (category) {
      case "media":
        return dashboard.spendByMediaHost.filter((r): r is typeof r & { mediaHostId: string } => Boolean(r.mediaHostId)).map((r) => ({ id: r.mediaHostId, name: r.name, amount: r.amount }));
      case "influencer":
        return dashboard.spendByInfluencer.filter((r): r is typeof r & { influencerId: string } => Boolean(r.influencerId)).map((r) => ({ id: r.influencerId, name: r.name, amount: r.amount }));
      case "member":
        return dashboard.spendByMember.filter((r): r is typeof r & { memberId: string } => Boolean(r.memberId)).map((r) => ({ id: r.memberId, name: r.name, amount: r.amount }));
      case "meeting":
        return dashboard.spendByEvent.map((r) => ({ id: r.eventId, name: r.name, amount: r.amount }));
      default:
        return [];
    }
  }, [dashboard, category]);

  const sorted = useMemo(() => [...rows].sort((a, b) => b.amount - a.amount), [rows]);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = q ? sorted.filter((r) => r.name.toLowerCase().includes(q)) : sorted;

  function hrefFor(id: string): string {
    switch (category) {
      case "media":
        return `/org/${organizationId}/media-hosts/${id}/payments`;
      case "influencer":
        return `/org/${organizationId}/influencers/${id}/payments`;
      case "member":
        return `/org/${organizationId}/members/${id}`;
      case "meeting":
        return `/org/${organizationId}/events/${id}`;
      default:
        return "#";
    }
  }

  function onExport() {
    const header = ["Name", "Amount"];
    const lines = [header.map(escapeCsv).join(",")];
    for (const r of sorted) lines.push([r.name, r.amount].map(escapeCsv).join(","));
    lines.push(["Total", total].map(escapeCsv).join(","));
    downloadCsv(`${category}-spend.csv`, lines.join("\n"));
  }

  return (
    <RequireAccess area="finance-reports">
      <div className="space-y-6">
        <Link href={`/org/${organizationId}/finance`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
          <ArrowLeft size={15} /> {t("backToListCta")}
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ink">{t(TITLE_KEY[category] ?? "totalSpend")}</h1>
            <p className="nums mt-1 text-lg font-bold text-brand-700">{total.toLocaleString()}</p>
          </div>
          <button type="button" onClick={onExport} className="btn-secondary text-sm"><Download size={14} /> {t("exportAllCta")}</button>
        </div>

        {!dashboard ? (
          <LoadingWord />
        ) : sorted.length === 0 ? (
          <p className="card text-muted">{t("noSpendYet")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <TableSearchInput value={search} onChange={setSearch} placeholder={t("searchGenericPlaceholder")} />
            </div>
            {filtered.length === 0 ? (
              <p className="card text-muted">{t("noSearchResults")}</p>
            ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">{t("nameLabel")}</th>
                  <th className="px-4 py-2.5 text-right">{t("amountLabel")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-2.5">
                      <Link href={hrefFor(r.id)} className="font-medium text-brand hover:underline">{r.name}</Link>
                    </td>
                    <td className="nums px-4 py-2.5 text-right font-semibold text-ink">{r.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </div>
    </RequireAccess>
  );
}
