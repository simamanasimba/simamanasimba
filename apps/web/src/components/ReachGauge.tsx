"use client";

import { useState } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { Pencil } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { EditReachTargetModal } from "@/components/EditReachTargetModal";
import { TargetKeyLegend } from "@/components/TargetKeyLegend";
import { targetTierColor } from "@/lib/targetColor";

export function ReachGauge({
  organizationId,
  entityType,
  entityId,
  value,
  target,
  onTargetSaved,
}: {
  organizationId: string;
  entityType: "media-hosts" | "influencers";
  entityId: string;
  value: number;
  target: number | null;
  onTargetSaved: () => void;
}) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const hasTarget = target != null && target > 0;
  const pct = hasTarget ? Math.min(100, Math.round((value / target!) * 100)) : 0;
  const color = targetTierColor(value, target ?? null);
  const data = [{ value: pct }];

  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-ink">{t("totalReachLabel")}</h2>
        <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline" onClick={() => setEditing(true)}>
          <Pencil size={12} /> {t("editTargetCta")}
        </button>
      </div>

      {/* Semi-circle meter — a top-half arc (startAngle 180 to 0), center point sunk to the
       * bottom of the container so the arc bows upward, matching the reference gauge design. */}
      <div className="relative mx-auto" style={{ width: 260, height: 150 }}>
        <RadialBarChart
          width={260}
          height={150}
          cx={130}
          cy={140}
          innerRadius={88}
          outerRadius={120}
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={16} background={{ fill: "#EFE7E5" }} fill={color} isAnimationActive={false} />
        </RadialBarChart>
        {/* Centered in the arc's hollow (from its inner edge at cy-innerRadius=52 down to
            cy=140), not glued to the container's bottom edge — that hollow, not the full
            260x150 box, is this half-circle's true visual center. */}
        <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center justify-center" style={{ top: 52, bottom: 0 }}>
          <p className="nums text-2xl font-extrabold" style={{ color }}>{hasTarget ? `${pct}%` : "—"}</p>
          <p className="mt-0.5 text-xs text-muted">
            {hasTarget ? `${value.toLocaleString()} ${t("ofLabel")} ${target!.toLocaleString()}` : t("tooltipNoTarget")}
          </p>
        </div>
      </div>

      <TargetKeyLegend className="mt-1 justify-center" />

      {editing && (
        <EditReachTargetModal
          organizationId={organizationId}
          entityType={entityType}
          entityId={entityId}
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
