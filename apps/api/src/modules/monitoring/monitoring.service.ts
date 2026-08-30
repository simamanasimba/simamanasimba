import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexService } from "../search-index/search-index.service";
import { AiProviderService } from "../ai/ai-provider.service";
import { DiscoveryEngine, BingWebSearchProvider, NewsApiProvider, type DiscoveredItem } from "@event-intel/connectors";
import type { AliasType, MonitoringQueryType, Prisma } from "@event-intel/database";

function dedupeKeyFor(item: DiscoveredItem): string {
  const basis = item.sourceUrl || `${item.sourceProvider}:${item.title ?? ""}`;
  return createHash("sha256").update(basis.trim().toLowerCase()).digest("hex");
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly discoveryEngine: DiscoveryEngine;

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService,
    private readonly ai: AiProviderService,
  ) {
    this.discoveryEngine = new DiscoveryEngine({
      webSearchProviders: [new BingWebSearchProvider(process.env.SEARCH_API_KEY)],
      newsProviders: [new NewsApiProvider(process.env.NEWS_API_KEY)],
    });
  }

  // ── Aliases ──────────────────────────────────────────────────────────
  createAlias(organizationId: string, alias: string, aliasType: AliasType) {
    return this.prisma.organizationAlias.upsert({
      where: { organizationId_alias: { organizationId, alias } },
      create: { organizationId, alias, aliasType },
      update: { aliasType },
    });
  }

  listAliases(organizationId: string) {
    return this.prisma.organizationAlias.findMany({ where: { organizationId } });
  }

  removeAlias(organizationId: string, aliasId: string) {
    return this.prisma.organizationAlias.deleteMany({ where: { id: aliasId, organizationId } });
  }

  // ── Rules ────────────────────────────────────────────────────────────
  async createRule(organizationId: string, input: { name: string; eventId?: string; queries: Array<{ queryType: MonitoringQueryType; value: string }>; languages?: string[]; countries?: string[] }) {
    return this.prisma.monitoringRule.create({
      data: {
        organizationId,
        name: input.name,
        eventId: input.eventId,
        languages: input.languages ?? [],
        countries: input.countries ?? [],
        queries: { create: input.queries.map((q) => ({ queryType: q.queryType, value: q.value })) },
      },
      include: { queries: true },
    });
  }

  listRules(organizationId: string) {
    return this.prisma.monitoringRule.findMany({ where: { organizationId }, include: { queries: true } });
  }

  private async ensureRule(organizationId: string, ruleId: string) {
    const rule = await this.prisma.monitoringRule.findFirst({ where: { id: ruleId, organizationId }, include: { queries: true } });
    if (!rule) throw new NotFoundException("Monitoring rule not found");
    return rule;
  }

  /**
   * Runs a monitoring rule through the discovery engine, deduplicates
   * against previously stored mentions, matches against the organization's
   * aliases, runs AI analysis (or the honest Noop stand-in), and persists
   * results. Returns a full run report — including which providers were
   * skipped for lacking credentials — so nothing is silently faked.
   */
  async runRule(organizationId: string, ruleId: string) {
    const rule = await this.ensureRule(organizationId, ruleId);
    const [aliases, org] = await Promise.all([
      this.prisma.organizationAlias.findMany({ where: { organizationId } }),
      this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    ]);

    const terms = rule.queries.map((q) => q.value);
    const discovery = await this.discoveryEngine.runQuery({
      terms,
      languages: rule.languages as string[],
      countries: rule.countries as string[],
    });

    const aliasTexts = [org.name, ...aliases.map((a) => a.alias)].map((a) => a.toLowerCase());
    let created = 0;
    let duplicates = 0;

    for (const item of discovery.items) {
      const dedupeKey = dedupeKeyFor(item);
      const haystack = `${item.title ?? ""} ${item.content ?? ""}`.toLowerCase();
      const matchedAlias = aliasTexts.find((a) => haystack.includes(a));

      if (item.sourceType === "news") {
        const result = await this.prisma.newsArticle.upsert({
          where: { organizationId_dedupeKey: { organizationId, dedupeKey } },
          create: {
            organizationId,
            title: item.title ?? "Untitled",
            url: item.sourceUrl,
            source: item.sourceProvider,
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
            dedupeKey,
            verificationStatus: matchedAlias ? "SOURCE_VERIFIED" : "DISCOVERED",
          },
          update: {},
        });
        if (result) created++;
        continue;
      }

      const existing = await this.prisma.mention.findUnique({ where: { organizationId_dedupeKey: { organizationId, dedupeKey } } });
      if (existing) {
        duplicates++;
        continue;
      }
      if (!matchedAlias) continue; // Not actually about this organization — drop rather than store noise.

      const mention = await this.prisma.mention.create({
        data: {
          organizationId,
          eventId: rule.eventId,
          canonicalId: dedupeKey,
          dedupeKey,
          sourceType: item.sourceType,
          sourceProvider: item.sourceProvider,
          sourceId: item.sourceId,
          sourceUrl: item.sourceUrl,
          sourceTimestamp: item.publishedAt ? new Date(item.publishedAt) : undefined,
          verificationStatus: "DISCOVERED",
          author: item.author,
          content: item.content,
          matchMethod: "alias_substring",
          matchConfidence: 0.6,
          matchedAlias,
        },
      });
      created++;

      const [sentiment, topic] = await Promise.all([
        this.ai.provider.analyzeSentiment(item.content ?? item.title ?? ""),
        this.ai.provider.classifyTopic(item.content ?? item.title ?? "", [
          "Health", "Education", "Water", "Scholarships", "Community", "Events", "Partnerships", "Funding", "Leadership", "Media", "Reputation", "Other",
        ]),
      ]);

      await this.prisma.$transaction([
        this.prisma.aiAnalysis.create({
          data: { mentionId: mention.id, analysisType: "SENTIMENT", result: sentiment as unknown as Prisma.InputJsonValue, sentiment: sentiment.label, confidence: sentiment.confidence, model: sentiment.model, modelVersion: sentiment.modelVersion },
        }),
        this.prisma.aiAnalysis.create({
          data: { mentionId: mention.id, analysisType: "TOPIC", result: topic as unknown as Prisma.InputJsonValue, confidence: topic.confidence, model: topic.model },
        }),
        this.prisma.mention.update({ where: { id: mention.id }, data: { topic: topic.topic, priority: sentiment.label === "NEGATIVE" ? "HIGH" : "LOW" } }),
      ]);

      if (sentiment.label === "NEGATIVE" && sentiment.confidence > 0.5) {
        await this.prisma.alert.create({
          data: {
            organizationId,
            eventId: rule.eventId,
            type: "NEGATIVE_SPIKE",
            title: `Negative mention detected: ${item.title ?? item.sourceUrl}`,
            message: item.content?.slice(0, 300),
            priority: "HIGH",
            metadata: { mentionId: mention.id },
          },
        });
      }

      await this.searchIndex
        .index({ id: mention.id, organizationId, entityType: "mention", title: item.title ?? item.sourceUrl, body: item.content, createdAt: mention.createdAt.toISOString() })
        .catch((err) => this.logger.warn(`Failed to index mention ${mention.id}: ${err instanceof Error ? err.message : err}`));
    }

    return { ...discovery, created, duplicates };
  }
}
