import type { SearchDocument, SearchEntityType, SearchProvider, SearchQuery, SearchResultPage } from "./types";

const INDEX_NAME = "event_intel_documents";

/**
 * Production search provider backed by OpenSearch's REST API (plain `fetch`,
 * no client SDK dependency). Falls back to PostgresSearchProvider when
 * OPENSEARCH_URL is not configured — see createSearchProvider().
 */
export class OpenSearchSearchProvider implements SearchProvider {
  readonly name = "opensearch" as const;

  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenSearch request failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async index(doc: SearchDocument): Promise<void> {
    await this.request(`/${INDEX_NAME}/_doc/${doc.entityType}:${doc.id}`, {
      method: "PUT",
      body: JSON.stringify(doc),
    });
  }

  async bulkIndex(docs: SearchDocument[]): Promise<void> {
    if (docs.length === 0) return;
    const lines = docs.flatMap((doc) => [
      JSON.stringify({ index: { _index: INDEX_NAME, _id: `${doc.entityType}:${doc.id}` } }),
      JSON.stringify(doc),
    ]);
    await this.request(`/_bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/x-ndjson" },
      body: lines.join("\n") + "\n",
    });
  }

  async remove(entityType: SearchEntityType, id: string): Promise<void> {
    await this.request(`/${INDEX_NAME}/_doc/${entityType}:${id}`, { method: "DELETE" });
  }

  async search(query: SearchQuery): Promise<SearchResultPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filter: unknown[] = [{ term: { organizationId: query.organizationId } }];
    if (query.entityTypes?.length) {
      filter.push({ terms: { entityType: query.entityTypes } });
    }

    const body = {
      from: (page - 1) * pageSize,
      size: pageSize,
      query: {
        bool: {
          must: [{ multi_match: { query: query.query, fields: ["title^2", "body"] } }],
          filter,
        },
      },
      highlight: { fields: { body: {} } },
    };

    const result = await this.request<{
      hits: { total: { value: number }; hits: Array<{ _id: string; _score: number; _source: SearchDocument; highlight?: { body?: string[] } }> };
    }>(`/${INDEX_NAME}/_search`, { method: "POST", body: JSON.stringify(body) });

    return {
      hits: result.hits.hits.map((h) => ({
        id: h._source.id,
        entityType: h._source.entityType,
        title: h._source.title,
        snippet: h.highlight?.body?.[0],
        score: h._score,
      })),
      total: result.hits.total.value,
      page,
      pageSize,
    };
  }
}
