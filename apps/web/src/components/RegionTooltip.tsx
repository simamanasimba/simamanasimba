"use client";

import { useLang } from "@/lib/i18n";

interface RegionTooltipDatum {
  region: string;
  count: number;
  target: number | null;
}

/** Custom Recharts tooltip for the Dashboard's region bar charts — shows reached/target/% in
 * place of the default value-only tooltip, since a plain bar can't show progress-against-target
 * on its own. */
export function RegionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RegionTooltipDatum }> }) {
  const { t } = useLang();
  if (!active || !payload?.length) return null;
  const { region, count, target } = payload[0].payload;
  const pct = target != null && target > 0 ? Math.round((count / target) * 100) : null;

  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-semibold text-ink">{region}</p>
      <p className="text-muted">{t("tooltipReached")}: <span className="nums font-medium text-ink">{count.toLocaleString()}</span></p>
      <p className="text-muted">{t("tooltipTarget")}: <span className="nums font-medium text-ink">{target != null ? target.toLocaleString() : t("tooltipNoTarget")}</span></p>
      {pct != null && <p className="text-muted">{t("tooltipProgress")}: <span className="nums font-medium text-ink">{pct}%</span></p>}
    </div>
  );
}
