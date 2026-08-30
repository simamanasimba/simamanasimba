import type { DiscoveredItem, DiscoveryQuery, NewsProvider } from "./types";

interface NewsApiArticle {
  source: { name: string };
  author: string | null;
  title: string;
  url: string;
  publishedAt: string;
  content: string | null;
  description: string | null;
}

/**
 * Real integration against newsapi.org's /v2/everything endpoint. Requires
 * NEWS_API_KEY — without it isConfigured() is false and callers must skip
 * this provider rather than fabricate news results (spec section 34).
 */
export class NewsApiProvider implements NewsProvider {
  readonly name = "newsapi";

  constructor(private readonly apiKey?: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: DiscoveryQuery): Promise<DiscoveredItem[]> {
    if (!this.apiKey) {
      throw new Error("NewsApiProvider is not configured: set NEWS_API_KEY");
    }
    const q = query.terms.map((t) => `"${t}"`).join(" OR ");
    const params = new URLSearchParams({
      q,
      apiKey: this.apiKey,
      sortBy: "publishedAt",
      language: query.languages?.[0] ?? "en",
    });
    if (query.sinceIso) params.set("from", query.sinceIso);

    const res = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`NewsAPI request failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as { articles: NewsApiArticle[] };
    return data.articles.map((a) => ({
      sourceType: "news" as const,
      sourceProvider: this.name,
      sourceUrl: a.url,
      title: a.title,
      content: a.content ?? a.description ?? undefined,
      author: a.author ?? undefined,
      publishedAt: a.publishedAt,
      raw: a,
    }));
  }
}
