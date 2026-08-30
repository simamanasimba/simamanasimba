"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { MediaEngagement } from "@/lib/types";
import { QuickUpdateReachModal } from "@/components/QuickUpdateReachModal";

/** Bounded preview (not the full, potentially very large, engagements list — that stays on the
 * dedicated paginated /campaigns subpage) shown inline for roles whose priority is campaigns
 * over payments. */
export function RecentCampaignsCard({
  organizationId,
  beneficiaryType,
  beneficiaryId,
  engagements,
  personnelName,
  viewAllHref,
  canUpdateReach,
  onReachUpdated,
}: {
  organizationId: string;
  beneficiaryType: "MEDIA_HOST" | "INFLUENCER";
  beneficiaryId: string;
  engagements: MediaEngagement[];
  personnelName: string;
  viewAllHref: string;
  canUpdateReach: boolean;
  onReachUpdated: () => void;
}) {
  const { t } = useLang();
  const preview = engagements.slice(0, 8);
  const [updatingReachFor, setUpdatingReachFor] = useState<MediaEngagement | null>(null);

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("recentCampaignsTitle")}</h2>
        <Link href={viewAllHref} className="text-sm font-medium text-brand hover:underline">{t("viewAllCampaignsCta")}</Link>
      </div>
      {preview.length === 0 ? (
        <p className="px-5 py-6 text-muted">{t("noCampaignsAtAll")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2.5">{t("topicPostAgendaLabel")}</th>
                <th className="px-5 py-2.5">{t("personnelNameColLabel")}</th>
                <th className="px-5 py-2.5">{t("reachColumnLabel")}</th>
                <th className="px-5 py-2.5">{t("paymentStatusLabel")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {preview.map((e) => (
                <tr key={e.id}>
                  <td className="max-w-[260px] truncate px-5 py-2.5 font-medium text-ink">{e.topicPostAgenda ?? "—"}</td>
                  <td className="px-5 py-2.5 text-muted">{personnelName}</td>
                  <td className="nums px-5 py-2.5 text-muted">
                    <div className="flex items-center gap-1.5">
                      <span>{e.likes != null || e.comments != null ? ((e.likes ?? 0) + (e.comments ?? 0)).toLocaleString() : "—"}</span>
                      {canUpdateReach && (
                        <button
                          type="button"
                          title={t("updateReachTooltip")}
                          className="text-muted hover:text-brand"
                          onClick={() => setUpdatingReachFor(e)}
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={`badge ${e.status === "PAID" ? "bg-green-50 text-success" : "bg-brand-50 text-brand-700"}`}>
                      {e.status === "PAID" ? t("statusPaid") : t("statusNotPaid")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {updatingReachFor && (
        <QuickUpdateReachModal
          organizationId={organizationId}
          beneficiaryType={beneficiaryType}
          beneficiaryId={beneficiaryId}
          engagement={updatingReachFor}
          onClose={() => setUpdatingReachFor(null)}
          onDone={() => { setUpdatingReachFor(null); onReachUpdated(); }}
        />
      )}
    </div>
  );
}
