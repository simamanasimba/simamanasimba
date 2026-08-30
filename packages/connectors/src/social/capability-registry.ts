import type { PlatformCapabilityDescriptor } from "../types";

/**
 * The authoritative, hand-verified capability registry (spec section 41).
 * Every entry was checked against the platform's current official developer
 * documentation before being marked SUPPORTED — never assume an endpoint
 * exists. Seeded into `platform_capabilities` on migration; update
 * `lastVerifiedAt` in the database whenever a capability is re-checked.
 */
export const PLATFORM_CAPABILITIES: PlatformCapabilityDescriptor[] = [
  {
    platform: "YOUTUBE",
    capability: "public_channel_statistics",
    status: "SUPPORTED",
    apiVersion: "v3",
    documentationUrl: "https://developers.google.com/youtube/v3/docs/channels/list",
    accessRequirements: "Google Cloud API key with YouTube Data API v3 enabled. No OAuth needed for public stats.",
    notes: "subscriberCount/viewCount/videoCount for a public channel via channels.list?part=statistics.",
  },
  {
    platform: "YOUTUBE",
    capability: "video_engagement_metrics",
    status: "SUPPORTED",
    apiVersion: "v3",
    documentationUrl: "https://developers.google.com/youtube/v3/docs/videos/list",
    accessRequirements: "Google Cloud API key with YouTube Data API v3 enabled.",
    notes: "likeCount/viewCount/commentCount per video via videos.list?part=statistics.",
  },
  {
    platform: "INSTAGRAM",
    capability: "account_insights",
    status: "REQUIRES_APPROVAL",
    apiVersion: "Graph API v21.0",
    documentationUrl: "https://developers.facebook.com/docs/instagram-api/guides/insights",
    accessRequirements:
      "Instagram Business/Creator account connected to a Facebook Page, a Meta developer app in Live mode with instagram_manage_insights permission, and App Review approval.",
  },
  {
    platform: "META",
    capability: "page_insights",
    status: "REQUIRES_APPROVAL",
    apiVersion: "Graph API v21.0",
    documentationUrl: "https://developers.facebook.com/docs/graph-api/reference/v21.0/insights",
    accessRequirements: "Facebook Page access token with read_insights permission, App Review approval for production access.",
  },
  {
    platform: "FACEBOOK",
    capability: "page_public_content",
    status: "REQUIRES_APPROVAL",
    apiVersion: "Graph API v21.0",
    documentationUrl: "https://developers.facebook.com/docs/pages-api",
    accessRequirements: "Facebook Page access token, App Review for pages_read_engagement in production.",
  },
  {
    platform: "LINKEDIN",
    capability: "organization_page_statistics",
    status: "REQUIRES_APPROVAL",
    apiVersion: "REST (Community Management API)",
    documentationUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-lookup-api",
    accessRequirements: "LinkedIn Marketing Developer Platform access (partnership approval), r_organization_social scope.",
  },
  {
    platform: "X",
    capability: "user_metrics",
    status: "REQUIRES_APPROVAL",
    apiVersion: "X API v2",
    documentationUrl: "https://developer.x.com/en/docs/x-api/users/lookup/api-reference/get-users-by-username-username",
    accessRequirements: "Paid X API access tier (Basic or higher) — the free tier does not expose public metrics reliably.",
  },
  {
    platform: "THREADS",
    capability: "account_insights",
    status: "REQUIRES_APPROVAL",
    apiVersion: "Threads API v1.0",
    documentationUrl: "https://developers.facebook.com/docs/threads/insights",
    accessRequirements: "Threads API app in Live mode, threads_manage_insights permission, App Review approval.",
  },
  {
    platform: "TIKTOK",
    capability: "account_metrics",
    status: "REQUIRES_APPROVAL",
    apiVersion: "TikTok for Developers v2",
    documentationUrl: "https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info/",
    accessRequirements: "TikTok Developer app approved for Login Kit + user.info.stats scope; audited app required for production.",
  },
];
