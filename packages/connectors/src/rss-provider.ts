import Parser from "rss-parser";
import type { DiscoveredItem, RssProvider } from "./types";

/**
 * Real, credential-free RSS/Atom ingestion — works the moment an organization
 * lists feed URLs (news sites, their own blog, Google News RSS queries) in a
 * monitoring rule. No API key required, so this is safe to run in every
 * environment including local dev.
 */
export class GenericRssProvider implements RssProvider {
  readonly name = "rss";
  private parser = new Parser();

  async fetchFeed(feedUrl: string): Promise<DiscoveredItem[]> {
    const feed = await this.parser.parseURL(feedUrl);
    return (feed.items ?? []).map((item) => ({
      sourceType: "rss" as const,
      sourceProvider: "rss",
      sourceId: item.guid ?? item.link,
      sourceUrl: item.link ?? feedUrl,
      title: item.title,
      content: item.contentSnippet ?? item.content,
      author: item.creator ?? item.author,
      publishedAt: item.isoDate ?? item.pubDate,
      raw: item,
    }));
  }
}
