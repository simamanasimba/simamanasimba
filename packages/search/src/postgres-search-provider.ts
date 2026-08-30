import type { SearchDocument, SearchEntityType, SearchProvider, SearchQuery, SearchResultPage } from "./types";

type SqlExecutor = <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;

interface SearchRow {
  id: string;
  entity_type: SearchEntityType;
  title: string;
  snippet: string;
  score: number;
  total: number;
}

/**
 * Development/self-hosted fallback: stores documents in a `search_documents` table
 * (see the `search_index` migration) and queries it with Postgres `tsvector`/`plainto_tsquery`.
 * Swap in the OpenSearch provider for production-scale relevance and faceting.
 */
export class PostgresSearchProvider implements SearchProvider {
  readonly name = "postgres" as const;

  constructor(private readonly sql: SqlExecutor) {}

  async index(doc: SearchDocument): Promise<void> {
    await this.sql`
      insert into search_documents (id, organization_id, entity_type, title, body, metadata, created_at, tsv)
      values (${doc.id}, ${doc.organizationId}, ${doc.entityType}, ${doc.title}, ${doc.body ?? ""},
              ${JSON.stringify(doc.metadata ?? {})}::jsonb, ${doc.createdAt},
              to_tsvector('english', coalesce(${doc.title}, '') || ' ' || coalesce(${doc.body ?? ""}, '')))
      on conflict (entity_type, id) do update set
        title = excluded.title,
        body = excluded.body,
        metadata = excluded.metadata,
        tsv = excluded.tsv
    `;
  }

  async bulkIndex(docs: SearchDocument[]): Promise<void> {
    for (const doc of docs) {
      await this.index(doc);
    }
  }

  async remove(entityType: SearchEntityType, id: string): Promise<void> {
    await this.sql`delete from search_documents where entity_type = ${entityType} and id = ${id}`;
  }

  async search(query: SearchQuery): Promise<SearchResultPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const entityTypes = query.entityTypes?.length ? query.entityTypes : null;

    const rows = entityTypes
      ? await this.sql<SearchRow[]>`
          select id, entity_type, title,
                 ts_headline('english', coalesce(body, ''), plainto_tsquery('english', ${query.query})) as snippet,
                 ts_rank(tsv, plainto_tsquery('english', ${query.query})) as score,
                 count(*) over() as total
          from search_documents
          where organization_id = ${query.organizationId}
            and tsv @@ plainto_tsquery('english', ${query.query})
            and entity_type = any(${entityTypes})
          order by score desc
          limit ${pageSize} offset ${offset}
        `
      : await this.sql<SearchRow[]>`
          select id, entity_type, title,
                 ts_headline('english', coalesce(body, ''), plainto_tsquery('english', ${query.query})) as snippet,
                 ts_rank(tsv, plainto_tsquery('english', ${query.query})) as score,
                 count(*) over() as total
          from search_documents
          where organization_id = ${query.organizationId}
            and tsv @@ plainto_tsquery('english', ${query.query})
          order by score desc
          limit ${pageSize} offset ${offset}
        `;

    return {
      hits: rows.map((r) => ({ id: r.id, entityType: r.entity_type, title: r.title, snippet: r.snippet, score: r.score })),
      total: rows[0]?.total ?? 0,
      page,
      pageSize,
    };
  }
}
