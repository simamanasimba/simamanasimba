import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { INFLUENCER2_PLATFORM_CATALOG, VIDEO_LIKE_CONTENT_TYPES, resolveCountsAsEngagement } from "./influencer2-platform-catalog";

/**
 * Seeds the platform/metric-definition catalog on every API boot (idempotent
 * upserts) — this is reference data the feature can't function without, and
 * unlike the demo seed script this must also run in production, where
 * `prisma db seed` never runs. Runs in every environment automatically via
 * Nest's OnModuleInit, so there's no manual "don't forget to seed prod" step.
 */
@Injectable()
export class Influencer2PlatformsService implements OnModuleInit {
  private readonly logger = new Logger(Influencer2PlatformsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      for (const platform of INFLUENCER2_PLATFORM_CATALOG) {
        const row = await this.prisma.influencer2Platform.upsert({
          where: { key: platform.key },
          create: { key: platform.key, name: platform.name, sortOrder: platform.sortOrder },
          update: { name: platform.name, sortOrder: platform.sortOrder },
        });
        for (const [index, metric] of platform.metrics.entries()) {
          await this.prisma.influencer2MetricDefinition.upsert({
            where: { platformId_key: { platformId: row.id, key: metric.key } },
            create: {
              platformId: row.id,
              key: metric.key,
              label: metric.label,
              category: metric.category,
              unit: metric.unit,
              videoOnly: metric.videoOnly ?? false,
              countsAsEngagement: resolveCountsAsEngagement(metric),
              sortOrder: index,
            },
            update: {
              label: metric.label,
              category: metric.category,
              unit: metric.unit,
              videoOnly: metric.videoOnly ?? false,
              countsAsEngagement: resolveCountsAsEngagement(metric),
              sortOrder: index,
            },
          });
        }
      }
    } catch (err) {
      this.logger.error("Failed to seed Influencer 2 platform catalog", err as Error);
    }
  }

  /** Every active platform + its metric definitions, optionally narrowed to
   * what's relevant for a given content type (hides videoOnly metrics for
   * non-video-like content) — the source the create-campaign platform
   * checklist and the metrics-entry form both render from. */
  async list(contentType?: string) {
    const platforms = await this.prisma.influencer2Platform.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        metricDefinitions: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    const isVideoLike = contentType ? VIDEO_LIKE_CONTENT_TYPES.has(contentType) : true;
    return platforms.map((p) => ({
      ...p,
      metricDefinitions: p.metricDefinitions.filter((m) => !m.videoOnly || isVideoLike),
    }));
  }
}
