import type { DiscoveredItem, DiscoveryQuery, NewsProvider, RssProvider, WebSearchProvider } from "./types";

export interface DiscoveryEngineDeps {
  webSearchProviders?: WebSearchProvider[];
  newsProviders?: NewsProvider[];
  rssProvider?: RssProvider;
}

export interface DiscoveryRunResult {
  items: DiscoveredItem[];
  providersRun: string[];
  providersSkipped: Array<{ name: string; reason: string }>;
  errors: Array<{ provider: string; message: string }>;
}

/**
 * Fans a monitoring query out across every configured provider. Providers
 * that lack credentials are skipped (and reported as skipped, never silently
 * dropped) rather than faking a result — see spec sections 34-36.
 */
export class DiscoveryEngine {
  constructor(private readonly deps: DiscoveryEngineDeps) {}

  async runQuery(query: DiscoveryQuery, feedUrls: string[] = []): Promise<DiscoveryRunResult> {
    const items: DiscoveredItem[] = [];
    const providersRun: string[] = [];
    const providersSkipped: Array<{ name: string; reason: string }> = [];
    const errors: Array<{ provider: string; message: string }> = [];

    const runProvider = async (
      name: string,
      configured: boolean,
      run: () => Promise<DiscoveredItem[]>,
    ): Promise<void> => {
      if (!configured) {
        providersSkipped.push({ name, reason: "not configured (missing API key)" });
        return;
      }
      try {
        items.push(...(await run()));
        providersRun.push(name);
      } catch (err) {
        errors.push({ provider: name, message: err instanceof Error ? err.message : String(err) });
      }
    };

    for (const provider of this.deps.webSearchProviders ?? []) {
      await runProvider(provider.name, provider.isConfigured(), () => provider.search(query));
    }
    for (const provider of this.deps.newsProviders ?? []) {
      await runProvider(provider.name, provider.isConfigured(), () => provider.search(query));
    }
    if (this.deps.rssProvider && feedUrls.length > 0) {
      for (const feedUrl of feedUrls) {
        await runProvider(`rss:${feedUrl}`, true, () => this.deps.rssProvider!.fetchFeed(feedUrl));
      }
    }

    return { items, providersRun, providersSkipped, errors };
  }
}
