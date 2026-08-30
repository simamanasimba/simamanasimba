export type SentimentKey = "positive" | "negative" | "neutral";
export const SENTIMENT_KEYS: SentimentKey[] = ["positive", "negative", "neutral"];

/** Keeps the three sentiment shares summing to exactly 100 — changing one
 * field proportionally redistributes the remaining budget across the other
 * two (an even split if both are currently zero). Shared between
 * Influencer2SentimentEditor (the click-to-expand editor) and
 * Influencer2PlatformModal (the "edit everything for this platform" form)
 * so the constraint behaves identically wherever sentiment is entered. */
export function redistributeSentiment(changed: SentimentKey, rawValue: number, current: Record<SentimentKey, number>): Record<SentimentKey, number> {
  const value = Math.max(0, Math.min(100, Math.round(rawValue)));
  const others = SENTIMENT_KEYS.filter((k) => k !== changed) as [SentimentKey, SentimentKey];
  const remaining = 100 - value;
  const otherSum = current[others[0]] + current[others[1]];
  let a: number;
  if (otherSum <= 0) a = Math.floor(remaining / 2);
  else a = Math.round((current[others[0]] / otherSum) * remaining);
  const b = remaining - a;
  return { ...current, [changed]: value, [others[0]]: a, [others[1]]: b };
}
