import type { DiscoveredItem, DiscoveryQuery, WebSearchProvider } from "./types";

interface BingWebPage {
  name: string;
  url: string;
  snippet: string;
  dateLastCrawled?: string;
}

/**
 * Real integration against Bing Web Search API. Requires SEARCH_API_KEY.
 * Chosen over Google Programmable Search because it needs a single key
 * (no separate search-engine-ID setup) — swap this implementation if the
 * organization prefers a different provider; callers only depend on
 * WebSearchProvider.
 */
export class BingWebSearchProvider implements WebSearchProvider {
  readonly name = "bing";

  constructor(private readonly apiKey?: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: DiscoveryQuery): Promise<DiscoveredItem[]> {
    if (!this.apiKey) {
      throw new Error("BingWebSearchProvider is not configured: set SEARCH_API_KEY");
    }
    const q = query.terms.map((t) => `"${t}"`).join(" OR ");
    const params = new URLSearchParams({ q, count: "20" });
    const res = await fetch(`https://api.bing.microsoft.com/v7.0/search?${params.toString()}`, {
      headers: { "Ocp-Apim-Subscription-Key": this.apiKey },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Bing Search request failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as { webPages?: { value: BingWebPage[] } };
    return (data.webPages?.value ?? []).map((page) => ({
      sourceType: "search" as const,
      sourceProvider: this.name,
      sourceUrl: page.url,
      title: page.name,
      content: page.snippet,
      publishedAt: page.dateLastCrawled,
      raw: page,
    }));
  }
}
