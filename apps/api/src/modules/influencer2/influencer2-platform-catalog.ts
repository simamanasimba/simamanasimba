import type { Influencer2MetricCategory } from "@event-intel/database";

/**
 * The "don't hard-code the form" catalog — every platform/metric offered by
 * Influencer 2 comes from this list, upserted into Influencer2Platform /
 * Influencer2MetricDefinition on API boot (see Influencer2PlatformsService).
 * Adding a platform or a metric later means editing this array, not rebuilding
 * any form component. Public-metrics-only per the user's explicit spec: no
 * Reach, no Insights-only numbers anywhere here.
 */
export interface MetricSeed {
  key: string;
  label: string;
  category: Influencer2MetricCategory;
  /** Hidden from the entry form unless the campaign's content type is video-like (VIDEO/REEL/STORY). */
  videoOnly?: boolean;
  /** Whether this metric counts toward "Total Public Engagement". Defaults to
   * false for VIEWS/SENTIMENT categories, true otherwise (see resolveCountsAsEngagement). */
  countsAsEngagement?: boolean;
  /** "percent" for the sentiment trio (must sum to 100), omitted for a plain count. */
  unit?: string;
}

export interface PlatformSeed {
  key: string;
  name: string;
  sortOrder: number;
  metrics: MetricSeed[];
}

/** Estimated comment-sentiment breakdown — offered alongside every platform's
 * base comment/reply count, never rolled into the plain "Total Comments"
 * bucket and never counted as engagement (it's a breakdown of an
 * already-counted metric, not additional engagement). Stored as percentages
 * that must sum to 100 across the trio — enforced client-side, see
 * Influencer2SentimentEditor.tsx. */
const SENTIMENT_METRICS: MetricSeed[] = [
  { key: "comments_positive", label: "Positive comments (estimated)", category: "SENTIMENT", countsAsEngagement: false, unit: "percent" },
  { key: "comments_negative", label: "Negative comments (estimated)", category: "SENTIMENT", countsAsEngagement: false, unit: "percent" },
  { key: "comments_neutral", label: "Neutral comments (estimated)", category: "SENTIMENT", countsAsEngagement: false, unit: "percent" },
];

export const INFLUENCER2_PLATFORM_CATALOG: PlatformSeed[] = [
  {
    key: "facebook",
    name: "Facebook",
    sortOrder: 1,
    metrics: [
      { key: "reactions_likes", label: "Reactions / Likes", category: "LIKES" },
      { key: "comments", label: "Comments", category: "COMMENTS" },
      ...SENTIMENT_METRICS,
      { key: "shares", label: "Shares", category: "SHARES" },
      { key: "views", label: "Views", category: "VIEWS", videoOnly: true },
    ],
  },
  {
    key: "instagram",
    name: "Instagram",
    sortOrder: 2,
    metrics: [
      { key: "likes", label: "Likes", category: "LIKES" },
      { key: "comments", label: "Comments", category: "COMMENTS" },
      ...SENTIMENT_METRICS,
      { key: "views_plays", label: "Views / Plays", category: "VIEWS", videoOnly: true },
    ],
  },
  {
    key: "youtube",
    name: "YouTube",
    sortOrder: 3,
    metrics: [
      { key: "views", label: "Views", category: "VIEWS", videoOnly: true },
      { key: "likes", label: "Likes", category: "LIKES" },
      { key: "comments", label: "Comments", category: "COMMENTS" },
      ...SENTIMENT_METRICS,
    ],
  },
  {
    key: "tiktok",
    name: "TikTok",
    sortOrder: 4,
    metrics: [
      { key: "views", label: "Views", category: "VIEWS", videoOnly: true },
      { key: "likes", label: "Likes", category: "LIKES" },
      { key: "comments", label: "Comments", category: "COMMENTS" },
      ...SENTIMENT_METRICS,
      { key: "shares", label: "Shares", category: "SHARES" },
      { key: "favorites", label: "Favorites", category: "OTHER" },
    ],
  },
  {
    key: "x",
    name: "X",
    sortOrder: 5,
    metrics: [
      { key: "views", label: "Views", category: "VIEWS" },
      { key: "likes", label: "Likes", category: "LIKES" },
      { key: "replies", label: "Replies", category: "COMMENTS" },
      ...SENTIMENT_METRICS,
      { key: "reposts", label: "Reposts", category: "SHARES" },
    ],
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    sortOrder: 6,
    metrics: [
      { key: "reactions", label: "Reactions", category: "LIKES" },
      { key: "comments", label: "Comments", category: "COMMENTS" },
      ...SENTIMENT_METRICS,
      { key: "reposts", label: "Reposts", category: "SHARES" },
      { key: "views", label: "Views", category: "VIEWS", videoOnly: true },
    ],
  },
];

export function resolveCountsAsEngagement(metric: MetricSeed): boolean {
  if (metric.countsAsEngagement != null) return metric.countsAsEngagement;
  return metric.category !== "VIEWS" && metric.category !== "SENTIMENT";
}

export const VIDEO_LIKE_CONTENT_TYPES = new Set(["VIDEO", "REEL", "STORY"]);
