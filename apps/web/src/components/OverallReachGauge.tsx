"use client";

import { useState } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { Pencil } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { EditMediaReachTargetModal } from "@/components/EditMediaReachTargetModal";

/** Org-wide reach across every media host and influencer combined. Deliberately its own look —
 * a red gradient semi-circle with flat stroke ends, not the red/amber/green tier coloring the
 * per-region bar charts use — per an explicit design spec for this one gauge specifically. */
export function OverallReachGauge({
  organizationId,
  totalReach,
  mediaReach,
  influencerReach,
  target,
  canEditTarget,
  onTargetSaved,
}: {
  organizationId: string;
  totalReach: number;
  mediaReach: number;
  influencerReach: number;
  target: number | null;
  canEditTarget: boolean;
  onTargetSaved: () => void;
}) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const hasTarget = target != null && target > 0;
  const pct = hasTarget ? Math.min(100, Math.round((totalReach / target!) * 100)) : 100;
  const data = [{ value: pct }];

  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-ink">{t("overallTotalReachLabel")}</h2>
          <p className="text-xs text-muted">{t("overallTotalReachHint")}</p>
        </div>
        {canEditTarget && (
          <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline" onClick={() => setEditing(true)}>
            <Pencil size={12} /> {t("editTargetCta")}
          </button>
        )}
      </div>

      <div className="mx-auto h-[120px] w-full max-w-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="98%" innerRadius="75%" outerRadius="100%" data={data} startAngle={180} endAngle={0}>
            <defs>
              <linearGradient id="overallReachGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#FCA5A5" />
                <stop offset="100%" stopColor="#DC2626" />
              </linearGradient>
            </defs>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={0} background={{ fill: "#FEF2F2" }} fill="url(#overallReachGradient)" isAnimationActive={false} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-col items-center text-center">
        {hasTarget ? (
          <>
            <p className="nums truncate text-3xl font-extrabold leading-tight text-red-700">{pct}%</p>
            <p className="mt-0.5 truncate text-xs text-muted">{totalReach.toLocaleString()} {t("ofLabel")} {target!.toLocaleString()}</p>
          </>
        ) : (
          <>
            <p className="nums truncate text-3xl font-extrabold leading-tight text-red-700">{totalReach.toLocaleString()}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{t("tooltipNoTarget")}</p>
          </>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 border-t border-line pt-3 text-center">
        <div>
          <p className="text-xs text-muted">{t("mediaReachLabel")}</p>
          <p className="nums text-lg font-bold text-ink">{mediaReach.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("influencerReachLabel")}</p>
          <p className="nums text-lg font-bold text-ink">{influencerReach.toLocaleString()}</p>
        </div>
      </div>

      {editing && (
        <EditMediaReachTargetModal
          organizationId={organizationId}
          current={target}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            onTargetSaved();
          }}
        />
      )}
    </div>
  );
}
