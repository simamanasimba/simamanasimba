/**
 * Metric values are append-only snapshots (see Influencer2MetricValue's isLatest flag) — there's
 * no per-period delta stored, only "what was the reported figure as of when it was collected."
 * For a date-ranged report, the practical reading of that is "the latest figure collected during
 * this window" per (campaignPlatform, metricDefinition) pair — this reduces a window's rows
 * (already sorted collectedAt desc) down to exactly that, mirroring what the DB-level isLatest
 * flag does for all-time queries.
 */
export function latestPerCampaignPlatformMetric<T extends { campaignPlatformId: string; metricDefinitionId: string }>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.campaignPlatformId}:${row.metricDefinitionId}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values());
}
