export interface DiscoveredItem {
  sourceType: "news" | "web" | "rss" | "search" | "social";
  sourceProvider: string;
  sourceId?: string;
  sourceUrl: string;
  title?: string;
  content?: string;
  author?: string;
  publishedAt?: string;
  raw: unknown;
}

export interface DiscoveryQuery {
  terms: string[];
  languages?: string[];
  countries?: string[];
  sinceIso?: string;
}

export interface WebSearchProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(query: DiscoveryQuery): Promise<DiscoveredItem[]>;
}

export interface NewsProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(query: DiscoveryQuery): Promise<DiscoveredItem[]>;
}

export interface RssProvider {
  readonly name: string;
  fetchFeed(feedUrl: string): Promise<DiscoveredItem[]>;
}

export type PlatformName = "YOUTUBE" | "INSTAGRAM" | "META" | "LINKEDIN" | "X" | "FACEBOOK" | "THREADS" | "TIKTOK";

export type CapabilityStatus = "SUPPORTED" | "PARTIAL" | "UNSUPPORTED" | "REQUIRES_APPROVAL";

export interface PlatformCapabilityDescriptor {
  platform: PlatformName;
  capability: string;
  status: CapabilityStatus;
  apiVersion?: string;
  documentationUrl: string;
  accessRequirements: string;
  notes?: string;
}

export interface SocialAccountMetrics {
  followers?: number;
  following?: number;
  posts?: number;
  notAvailable: string[];
  fetchedAt: string;
}

export interface SocialConnectorResult<T> {
  status: "OK" | "UNSUPPORTED" | "NOT_CONNECTED" | "ERROR";
  data?: T;
  message?: string;
}

export interface SocialConnector {
  readonly platform: PlatformName;
  getCapabilities(): PlatformCapabilityDescriptor[];
  fetchAccountMetrics(externalAccountId: string, credentials: Record<string, string>): Promise<SocialConnectorResult<SocialAccountMetrics>>;
  fetchRecentContent(externalAccountId: string, credentials: Record<string, string>): Promise<SocialConnectorResult<DiscoveredItem[]>>;
}
