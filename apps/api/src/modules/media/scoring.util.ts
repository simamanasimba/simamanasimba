import type { MetricFieldType, TrackerMetric } from "@event-intel/database";

export interface EntryLike {
  metricId: string;
  numericValue: unknown;
  boolValue: boolean | null;
}

const SUMMABLE: MetricFieldType[] = ["NUMBER", "DECIMAL", "CURRENCY"];
const AVERAGED: MetricFieldType[] = ["PERCENTAGE", "RATING"];

/** Sums NUMBER/DECIMAL/CURRENCY metrics, averages PERCENTAGE/RATING ones, counts true BOOLEAN — the same rule used for a single subject's totals and for a whole campaign's summary. */
export function aggregateByMetric(entries: EntryLike[], metrics: TrackerMetric[]): Map<string, number> {
  const byMetric = new Map<string, EntryLike[]>();
  for (const entry of entries) {
    const list = byMetric.get(entry.metricId) ?? [];
    list.push(entry);
    byMetric.set(entry.metricId, list);
  }

  const result = new Map<string, number>();
  for (const metric of metrics) {
    const rows = byMetric.get(metric.id) ?? [];
    if (metric.fieldType === "BOOLEAN") {
      result.set(metric.id, rows.filter((r) => r.boolValue).length);
      continue;
    }
    const numbers = rows.map((r) => Number(r.numericValue)).filter((n) => !Number.isNaN(n));
    if (numbers.length === 0) continue;
    if (SUMMABLE.includes(metric.fieldType)) {
      result.set(metric.id, numbers.reduce((a, b) => a + b, 0));
    } else if (AVERAGED.includes(metric.fieldType)) {
      result.set(metric.id, numbers.reduce((a, b) => a + b, 0) / numbers.length);
    }
  }
  return result;
}

/**
 * Weighted average of each scoring-enabled metric's achievement against its
 * target (value/target×100), or the raw aggregated value when no target is
 * set (for metrics already on a 0–100-ish scale, e.g. a rating or a
 * percentage). Metrics without scoringEnabled/weight don't participate —
 * a metric can be tracked without ever contributing to the score.
 */
export function computePerformanceScore(aggregated: Map<string, number>, metrics: TrackerMetric[]): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const metric of metrics) {
    if (!metric.scoringEnabled || metric.weight == null) continue;
    const value = aggregated.get(metric.id);
    if (value == null) continue;
    const weight = Number(metric.weight);
    const contribution = metric.target != null ? (value / Number(metric.target)) * 100 : value;
    weightedSum += weight * contribution;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}
