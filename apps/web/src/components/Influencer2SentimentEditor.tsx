"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { redistributeSentiment, type SentimentKey } from "@/lib/sentimentRedistribute";

export function Influencer2SentimentEditor({
  organizationId,
  campaignId,
  campaignPlatformId,
  platformName,
  definitionIds,
  initial,
  onSaved,
}: {
  organizationId: string;
  campaignId: string;
  campaignPlatformId: string;
  platformName: string;
  definitionIds: { positive: string; negative: string; neutral: string };
  initial: { positive: number | null; negative: number | null; neutral: number | null };
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [values, setValues] = useState<Record<SentimentKey, number>>({
    positive: initial.positive ?? 0,
    negative: initial.negative ?? 0,
    neutral: initial.neutral ?? (initial.positive == null && initial.negative == null ? 100 : 0),
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onChange(key: SentimentKey, raw: string) {
    const n = raw === "" ? 0 : Number(raw);
    setValues((prev) => redistributeSentiment(key, n, prev));
    setDirty(true);
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaignId}/platforms/${campaignPlatformId}/metrics`, {
        metrics: [
          { metricDefinitionId: definitionIds.positive, value: values.positive },
          { metricDefinitionId: definitionIds.negative, value: values.negative },
          { metricDefinitionId: definitionIds.neutral, value: values.neutral },
        ],
      });
      setDirty(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3">
      <p className="min-w-[100px] text-sm font-semibold text-ink">{platformName}</p>
      <div className="flex flex-1 flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-success" /> {t("influencer2PositiveLabel")}
          <input type="number" min="0" max="100" className="input !w-16 !py-1 text-center" value={values.positive} onChange={(e) => onChange("positive", e.target.value)} />%
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" /> {t("influencer2NegativeLabel")}
          <input type="number" min="0" max="100" className="input !w-16 !py-1 text-center" value={values.negative} onChange={(e) => onChange("negative", e.target.value)} />%
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-line" /> {t("influencer2NeutralLabel")}
          <input type="number" min="0" max="100" className="input !w-16 !py-1 text-center" value={values.neutral} onChange={(e) => onChange("neutral", e.target.value)} />%
        </label>
      </div>
      {error && <p className="text-xs text-brand">{error}</p>}
      {dirty && (
        <button type="button" title={t("save")} onClick={onSave} disabled={saving} className="btn-primary !p-2">
          <Check size={14} />
        </button>
      )}
    </div>
  );
}
