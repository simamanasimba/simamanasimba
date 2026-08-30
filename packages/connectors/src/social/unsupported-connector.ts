import type {
  DiscoveredItem,
  PlatformCapabilityDescriptor,
  PlatformName,
  SocialAccountMetrics,
  SocialConnector,
  SocialConnectorResult,
} from "../types";
import { PLATFORM_CAPABILITIES } from "./capability-registry";

/**
 * Honest placeholder for platforms whose official APIs require app-review
 * approval this deployment doesn't yet have (Instagram, Meta, LinkedIn, X,
 * Facebook, Threads, TikTok — see capability-registry.ts). Every call
 * returns UNSUPPORTED with the concrete access requirement rather than
 * fabricating metrics (spec sections 40/84).
 */
export class UnsupportedSocialConnector implements SocialConnector {
  constructor(public readonly platform: PlatformName) {}

  getCapabilities(): PlatformCapabilityDescriptor[] {
    return PLATFORM_CAPABILITIES.filter((c) => c.platform === this.platform);
  }

  private unsupportedMessage(): string {
    const requirement = this.getCapabilities()[0]?.accessRequirements ?? "official API access";
    return `${this.platform} connector requires: ${requirement}`;
  }

  async fetchAccountMetrics(): Promise<SocialConnectorResult<SocialAccountMetrics>> {
    return { status: "UNSUPPORTED", message: this.unsupportedMessage() };
  }

  async fetchRecentContent(): Promise<SocialConnectorResult<DiscoveredItem[]>> {
    return { status: "UNSUPPORTED", message: this.unsupportedMessage() };
  }
}
