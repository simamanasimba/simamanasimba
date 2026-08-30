import type { SearchDocument, SearchEntityType, SearchProvider, SearchQuery, SearchResultPage } from "./types";

type SqlExecutor = <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;

interface SearchRow {
  id: string;
  entity_type: SearchEntityType;
  title: string;
  body: string | null;
}

/**
 * Development/self-hosted fallback for MySQL/MariaDB: simple `LIKE`
 * matching against a `search_documents` table — deliberately not using
 * MySQL FULLTEXT indexes (which need InnoDB-specific setup and Prisma
 * preview features) to keep this dependency-free. Swap in the OpenSearch
 * provider for real relevance ranking and scale in production.
 */
export class MySqlSearchProvider implements SearchProvider {
  readonly name = "mysql" as const;

  constructor(private readonly sql: SqlExecutor) {}

  async index(doc: SearchDocument): Promise<void> {
    await this.sql`
      insert into search_documents (id, entity_type, organization_id, title, body, metadata, created_at)
      values (${doc.id}, ${doc.entityType}, ${doc.organizationId}, ${doc.title}, ${doc.body ?? ""},
              ${JSON.stringify(doc.metadata ?? {})}, ${doc.createdAt})
      on duplicate key update
        title = values(title),
        body = values(body),
        metadata = values(metadata)
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
    const like = `%${query.query}%`;
    const entityTypes = query.entityTypes?.length ? new Set(query.entityTypes) : null;

    // Fetch a larger window and filter entityTypes in JS: MySQL's tagged-template
    // driver doesn't expand an array into an `IN (...)` list the way Prisma.join()
    // does, and this generic SqlExecutor has no access to Prisma.join. Fine for a
    // dev fallback — use OpenSearch in production for real faceted filtering.
    const fetchSize = entityTypes ? pageSize * 5 : pageSize;
    const rows = await this.sql<SearchRow[]>`
      select id, entity_type, title, body
      from search_documents
      where organization_id = ${query.organizationId}
        and (title like ${like} or body like ${like})
      order by title asc
      limit ${fetchSize}
    `;

    const filtered = entityTypes ? rows.filter((r) => entityTypes.has(r.entity_type)) : rows;
    const page_ = filtered.slice(offset, offset + pageSize);

    return {
      hits: page_.map((r) => ({ id: r.id, entityType: r.entity_type, title: r.title, snippet: r.body?.slice(0, 200), score: 1 })),
      total: filtered.length,
      page,
      pageSize,
    };
  }
}
