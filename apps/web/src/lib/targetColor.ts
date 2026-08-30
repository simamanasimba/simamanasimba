/** No target configured → neutral. Otherwise the same below/medium/met tiers used everywhere a
 * value is compared against a target (reach gauges, region bar charts), so "target status" reads
 * consistently across the whole app. */
export function targetTierColor(value: number, target: number | null | undefined): string {
  if (target == null || target <= 0) return "#EFE7E5";
  const pct = value / target;
  if (pct >= 1) return "#16A34A";
  if (pct >= 0.5) return "#D97706";
  return "#B91C1C";
}
