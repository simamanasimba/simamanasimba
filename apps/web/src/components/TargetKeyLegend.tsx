"use client";

import { useLang } from "@/lib/i18n";

/** The below/medium/met color key, shared by every chart that color-codes bars/gauges against a
 * configurable target (Dashboard region charts, profile-page reach gauge) — keeps the meaning of
 * red/amber/green consistent and explained everywhere it's used. */
export function TargetKeyLegend({ className = "" }: { className?: string }) {
  const { t } = useLang();
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted ${className}`}>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#B91C1C" }} />{t("keyBelowTarget")}</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#D97706" }} />{t("keyMediumTarget")}</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#16A34A" }} />{t("keyTargetMet")}</span>
    </div>
  );
}
