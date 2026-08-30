import type {
  DiscoveredItem,
  PlatformCapabilityDescriptor,
  SocialAccountMetrics,
  SocialConnector,
  SocialConnectorResult,
} from "../types";
import { PLATFORM_CAPABILITIES } from "./capability-registry";

interface YoutubeChannelListResponse {
  items: Array<{
    id: string;
    statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount: boolean };
  }>;
}

interface YoutubeSearchResponse {
  items: Array<{ id: { videoId: string }; snippet: { title: string; publishedAt: string; channelTitle: string } }>;
}

/**
 * Real connector using the YouTube Data API v3 with a plain API key —
 * genuinely working today without any OAuth flow, unlike the other social
 * platforms which require app review. See capability-registry.ts.
 */
export class YoutubeConnector implements SocialConnector {
  readonly platform = "YOUTUBE" as const;

  getCapabilities(): PlatformCapabilityDescriptor[] {
    return PLATFORM_CAPABILITIES.filter((c) => c.platform === "YOUTUBE");
  }

  async fetchAccountMetrics(
    channelId: string,
    credentials: Record<string, string>,
  ): Promise<SocialConnectorResult<SocialAccountMetrics>> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      return { status: "NOT_CONNECTED", message: "No YouTube API key configured for this organization" };
    }
    const params = new URLSearchParams({ part: "statistics", id: channelId, key: apiKey });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "ERROR", message: `YouTube API error (${res.status}): ${body}` };
    }
    const data = (await res.json()) as YoutubeChannelListResponse;
    const stats = data.items[0]?.statistics;
    if (!stats) {
      return { status: "ERROR", message: `Channel ${channelId} not found` };
    }
    return {
      status: "OK",
      data: {
        followers: stats.hiddenSubscriberCount ? undefined : Number(stats.subscriberCount ?? 0),
        posts: Number(stats.videoCount ?? 0),
        notAvailable: ["following", "reach", "impressions", "engagement rate"].concat(
          stats.hiddenSubscriberCount ? ["followers (hidden by channel owner)"] : [],
        ),
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  async fetchRecentContent(
    channelId: string,
    credentials: Record<string, string>,
  ): Promise<SocialConnectorResult<DiscoveredItem[]>> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      return { status: "NOT_CONNECTED", message: "No YouTube API key configured for this organization" };
    }
    const params = new URLSearchParams({
      part: "snippet",
      channelId,
      order: "date",
      maxResults: "10",
      type: "video",
      key: apiKey,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "ERROR", message: `YouTube API error (${res.status}): ${body}` };
    }
    const data = (await res.json()) as YoutubeSearchResponse;
    return {
      status: "OK",
      data: data.items.map((item) => ({
        sourceType: "social" as const,
        sourceProvider: "youtube",
        sourceId: item.id.videoId,
        sourceUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        title: item.snippet.title,
        author: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        raw: item,
      })),
    };
  }
}
