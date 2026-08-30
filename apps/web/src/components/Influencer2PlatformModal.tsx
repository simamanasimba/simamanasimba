"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import { redistributeSentiment, type SentimentKey } from "@/lib/sentimentRedistribute";
import type { Influencer2ContentType, Influencer2Platform, Influencer2PlatformSummary } from "@/lib/types";

/** Add a new platform to a campaign, or edit an already-attached one —
 * publication details AND every metric that applies to THAT platform (they
 * differ platform to platform, so this reads the platform's own metric
 * definitions rather than showing a generic fixed set) are all editable
 * together here, per explicit request: "in edit mode I must see all
 * metrics." Kept separate from Influencer2CampaignModal so that modal never
 * has to reconcile add/remove/edit of platforms already on a campaign. */
export function Influencer2PlatformModal({
  organizationId,
  campaignId,
  contentType,
  existingPlatformIds,
  editing,
  onClose,
  onDone,
}: {
  organizationId: string;
  campaignId: string;
  contentType: Influencer2ContentType;
  existingPlatformIds: string[];
  editing?: Influencer2PlatformSummary;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [platformId, setPlatformId] = useState(editing?.platformId ?? "");
  const [postUrl, setPostUrl] = useState(editing?.postUrl ?? "");
  const [publishedAt, setPublishedAt] = useState(editing?.publishedAt?.slice(0, 10) ?? "");
  const [metricValues, setMetricValues] = useState<Record<string, string>>(
    Object.fromEntries((editing?.metrics ?? []).map((m) => [m.metricDefinitionId, m.value.toString()])),
  );
  const [sentiment, setSentiment] = useState<Record<SentimentKey, number>>({
    positive: editing?.sentiment?.positive ?? 0,
    negative: editing?.sentiment?.negative ?? 0,
    neutral: editing?.sentiment?.neutral ?? (editing?.sentiment?.positive == null && editing?.sentiment?.negative == null ? 100 : 0),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: platforms } = useQuery({
    queryKey: ["influencer2-platforms", organizationId, contentType],
    queryFn: () => api.get<Influencer2Platform[]>(`/api/v1/organizations/${organizationId}/influencer2/platforms?contentType=${contentType}`),
  });
  const available = (platforms ?? []).filter((p) => !existingPlatformIds.includes(p.id));

  const activePlatform = (platforms ?? []).find((p) => p.id === platformId);
  const mainDefs = (activePlatform?.metricDefinitions ?? []).filter((d) => d.category !== "SENTIMENT");
  const sentimentDefs = (activePlatform?.metricDefinitions ?? []).filter((d) => d.category === "SENTIMENT");
  const sentimentIds = {
    positive: sentimentDefs.find((d) => d.key === "comments_positive")?.id,
    negative: sentimentDefs.find((d) => d.key === "comments_negative")?.id,
    neutral: sentimentDefs.find((d) => d.key === "comments_neutral")?.id,
  };
  const hasSentiment = Boolean(sentimentIds.positive && sentimentIds.negative && sentimentIds.neutral);

  function setSentimentValue(key: SentimentKey, raw: string) {
    setSentiment((prev) => redistributeSentiment(key, raw === "" ? 0 : Number(raw), prev));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const pubPayload = { postUrl: postUrl || undefined, publishedAt: publishedAt || undefined };
      let campaignPlatformId = editing?.campaignPlatformId;
      if (editing) {
        await api.patch(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaignId}/platforms/${editing.campaignPlatformId}`, pubPayload);
      } else {
        const created = await api.post<{ id: string }>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaignId}/platforms`, { platformId, ...pubPayload });
        campaignPlatformId = created.id;
      }

      const metrics = mainDefs
        .filter((d) => metricValues[d.id] !== undefined && metricValues[d.id] !== "")
        .map((d) => ({ metricDefinitionId: d.id, value: Number(metricValues[d.id]) }));
      if (hasSentiment && sentimentIds.positive && sentimentIds.negative && sentimentIds.neutral) {
        metrics.push(
          { metricDefinitionId: sentimentIds.positive, value: sentiment.positive },
          { metricDefinitionId: sentimentIds.negative, value: sentiment.negative },
          { metricDefinitionId: sentimentIds.neutral, value: sentiment.neutral },
        );
      }
      if (metrics.length > 0 && campaignPlatformId) {
        await api.post(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaignId}/platforms/${campaignPlatformId}/metrics`, { metrics });
      }

      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={editing ? editing.platformName : t("influencer2AddPlatformCta")} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
        {!editing && (
          <div>
            <label className="label">{t("influencer2FilterPlatform")}</label>
            <select required className="input" value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
              <option value="" disabled>{t("influencer2FilterPlatform")}</option>
              {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("influencer2PostUrlLabel")}</label>
            <input type="url" className="input" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("influencer2PublishedAtLabel")}</label>
            <input type="date" className="input" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
          </div>
        </div>

        {mainDefs.length > 0 && (
          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("influencer2PublicMetricsHint")}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {mainDefs.map((d) => (
                <div key={d.id}>
                  <label className="label">{d.label}</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={metricValues[d.id] ?? ""}
                    onChange={(e) => setMetricValues((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {hasSentiment && (
          <div className="rounded-xl bg-surface p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("influencer2SentimentTitle")}</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">{t("influencer2PositiveLabel")}</label>
                <input type="number" min="0" max="100" className="input" value={sentiment.positive} onChange={(e) => setSentimentValue("positive", e.target.value)} />
              </div>
              <div>
                <label className="label">{t("influencer2NegativeLabel")}</label>
                <input type="number" min="0" max="100" className="input" value={sentiment.negative} onChange={(e) => setSentimentValue("negative", e.target.value)} />
              </div>
              <div>
                <label className="label">{t("influencer2NeutralLabel")}</label>
                <input type="number" min="0" max="100" className="input" value={sentiment.neutral} onChange={(e) => setSentimentValue("neutral", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting || (!editing && !platformId)} className="btn-primary">{submitting ? t("saving") : t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
