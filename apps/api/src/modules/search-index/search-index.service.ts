import { Injectable } from "@nestjs/common";
import { createSearchProvider, type SearchDocument, type SearchProvider, type SearchQuery } from "@event-intel/search";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Thin wrapper around @event-intel/search's provider abstraction, bound to
 * this API's Prisma client so the Postgres fallback can run raw SQL through
 * the same connection pool. Used by every module that creates/updates a
 * searchable entity (members, events, mentions, news) and by the global
 * search endpoint (spec section 55).
 */
@Injectable()
export class SearchIndexService {
  private readonly provider: SearchProvider;

  constructor(private readonly prisma: PrismaService) {
    this.provider = createSearchProvider({
      openSearchUrl: process.env.OPENSEARCH_URL,
      sqlDialect: "mysql",
      sql: this.prisma.$queryRaw.bind(this.prisma),
    });
  }

  index(doc: SearchDocument): Promise<void> {
    return this.provider.index(doc);
  }

  search(query: SearchQuery) {
    return this.provider.search(query);
  }
}
