export type SearchEntityType = "member" | "event" | "mention" | "news_article" | "report";

export interface SearchDocument {
  id: string;
  organizationId: string;
  entityType: SearchEntityType;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SearchQuery {
  organizationId: string;
  query: string;
  entityTypes?: SearchEntityType[];
  page?: number;
  pageSize?: number;
}

export interface SearchHit {
  id: string;
  entityType: SearchEntityType;
  title: string;
  snippet?: string;
  score: number;
}

export interface SearchResultPage {
  hits: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Search abstraction so the platform can run against OpenSearch in production
 * and fall back to a plain-SQL LIKE search (Postgres or MySQL/MariaDB) in
 * development/self-hosted setups.
 */
export interface SearchProvider {
  readonly name: "opensearch" | "postgres" | "mysql";
  index(doc: SearchDocument): Promise<void>;
  bulkIndex(docs: SearchDocument[]): Promise<void>;
  remove(entityType: SearchEntityType, id: string): Promise<void>;
  search(query: SearchQuery): Promise<SearchResultPage>;
}
