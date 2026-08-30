export * from "./types";
export { DiscoveryEngine } from "./discovery-engine";
export { GenericRssProvider } from "./rss-provider";
export { NewsApiProvider } from "./news-provider";
export { BingWebSearchProvider } from "./web-search-provider";
export { PLATFORM_CAPABILITIES } from "./social/capability-registry";
export { YoutubeConnector } from "./social/youtube-connector";
export { UnsupportedSocialConnector } from "./social/unsupported-connector";

import type { PlatformName, SocialConnector } from "./types";
import { YoutubeConnector } from "./social/youtube-connector";
import { UnsupportedSocialConnector } from "./social/unsupported-connector";

export function getSocialConnector(platform: PlatformName): SocialConnector {
  if (platform === "YOUTUBE") return new YoutubeConnector();
  return new UnsupportedSocialConnector(platform);
}
