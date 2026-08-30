export * from "./types";
export { PostgresSearchProvider } from "./postgres-search-provider";
export { MySqlSearchProvider } from "./mysql-search-provider";
export { OpenSearchSearchProvider } from "./opensearch-search-provider";

import type { SearchProvider } from "./types";
import { PostgresSearchProvider } from "./postgres-search-provider";
import { MySqlSearchProvider } from "./mysql-search-provider";
import { OpenSearchSearchProvider } from "./opensearch-search-provider";

type SqlExecutor = <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;

/**
 * Picks OpenSearch when OPENSEARCH_URL is configured, otherwise a plain-SQL
 * fallback matching the active Prisma datasource ("postgresql" or "mysql").
 */
export function createSearchProvider(opts: { openSearchUrl?: string; sqlDialect?: "postgresql" | "mysql"; sql: SqlExecutor }): SearchProvider {
  if (opts.openSearchUrl) {
    return new OpenSearchSearchProvider(opts.openSearchUrl);
  }
  if (opts.sqlDialect === "mysql") {
    return new MySqlSearchProvider(opts.sql);
  }
  return new PostgresSearchProvider(opts.sql);
}
