"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";

interface CampaignReportRow {
  id: string;
  name: string;
  contentType: string;
  status: string;
  createdAt: string;
  beneficiaryName: string;
  mediaType: string | null;
  platforms: string[];
}

interface CampaignReportDetails {
  campaigns: CampaignReportRow[];
  byPlatform: Array<{ platform: string; count: number }>;
  byMediaType: Array<{ type: string; count: number }>;
}

function sentenceCase(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * The "show me the actual data" drill-down behind every stat tile on the Media/Influencer
 * dashboards — same underlying campaign set as the tiles' numbers (same scope + range), so
 * whichever tile was clicked, this answers "which campaigns, on which platforms, for which media
 * type, made up that number."
 */
export function CampaignReportModal({
  organizationId,
  scope,
  range,
  onClose,
}: {
  organizationId: string;
  scope: "ALL_MEDIA_HOSTS" | "ALL_INFLUENCERS";
  range: { from: string; to: string };
  onClose: () => void;
}) {
  const { t } = useLang();
  const { data, isLoading } = useQuery({
    queryKey: ["influencer2-report-details", scope, organizationId, range.from, range.to],
    queryFn: () => api.get<CampaignReportDetails>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/report-details?scope=${scope}&from=${range.from}&to=${range.to}`),
  });

  const title = scope === "ALL_MEDIA_HOSTS" ? t("mediaCampaignsReportTitle") : t("influencerCampaignsReportTitle");

  return (
    <Modal title={title} onClose={onClose} xl>
      {isLoading || !data ? (
        <p className="text-sm text-muted">{t("loadingLabel")}</p>
      ) : data.campaigns.length === 0 ? (
        <p className="text-sm text-muted">{t("noEngagementYet")}</p>
      ) : (
        <div className="space-y-4">
          {data.byPlatform.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t("byPlatformLabel")}</h3>
              <div className="flex flex-wrap gap-2">
                {data.byPlatform.map(({ platform, count }) => (
                  <span key={platform} className="badge bg-brand-50 text-brand-700">{platform} <span className="nums font-bold">{count}</span></span>
                ))}
              </div>
            </div>
          )}
          {data.byMediaType.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t("byMediaTypeLabel")}</h3>
              <div className="flex flex-wrap gap-2">
                {data.byMediaType.map(({ type, count }) => (
                  <span key={type} className="badge bg-surface text-ink">{sentenceCase(type)} <span className="nums font-bold">{count}</span></span>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">{t("nameLabel")}</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">{scope === "ALL_MEDIA_HOSTS" ? t("hostNameLabel") : t("influencerLabel")}</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">{t("platformsLabel")}</th>
                  {scope === "ALL_MEDIA_HOSTS" && <th className="whitespace-nowrap py-2 pr-3 font-semibold">{t("typeLabel")}</th>}
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">{t("statusLabel")}</th>
                  <th className="whitespace-nowrap py-2 font-semibold">{t("createdLabel")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {data.campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap py-2 pr-3 font-medium text-ink">{c.name}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-muted">{c.beneficiaryName}</td>
                    <td className="py-2 pr-3 text-muted">{c.platforms.length ? c.platforms.join(", ") : "—"}</td>
                    {scope === "ALL_MEDIA_HOSTS" && <td className="whitespace-nowrap py-2 pr-3 text-muted">{c.mediaType ? sentenceCase(c.mediaType) : "—"}</td>}
                    <td className="whitespace-nowrap py-2 pr-3"><span className="badge bg-surface text-muted">{sentenceCase(c.status)}</span></td>
                    <td className="whitespace-nowrap py-2 text-muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
