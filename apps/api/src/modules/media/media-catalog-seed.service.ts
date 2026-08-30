import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { loadMediaCatalog } from "./media-catalog.util";

/** Seeds the Media House reference list (e.g. "Azam Media", "Wasafi Media") for every
 * organization, from the checked-in data/tanzania_media_catalog.json, on every API boot — purely
 * as dropdown-suggestion data for registering a MediaHost. This does NOT make any of these
 * outlets "active" or "in use" anywhere else in the app — the dashboard's active-media count and
 * every list view only ever count an outlet once a real MediaHost is actually registered under
 * it (see MediaEngagementOverviewService). Matched by the catalog's own stable id (never by
 * name), `update: {}` (create-if-missing only) — an admin renaming a seeded outlet is never
 * silently reverted by the next boot. Failures are caught and logged, never thrown. */
@Injectable()
export class MediaCatalogSeedService implements OnModuleInit {
  private readonly logger = new Logger(MediaCatalogSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const catalog = loadMediaCatalog();
      if (!catalog) {
        this.logger.warn("Media catalog file not found — skipping media house seed");
        return;
      }

      const organizations = await this.prisma.organization.findMany({ select: { id: true } });
      for (const org of organizations) {
        for (const house of catalog.media_houses) {
          await this.prisma.mediaOutlet.upsert({
            where: { organizationId_externalId: { organizationId: org.id, externalId: house.id } },
            create: { organizationId: org.id, name: house.name, externalId: house.id },
            update: {},
          });
        }
      }
    } catch (err) {
      this.logger.error("Failed to seed media house catalog", err as Error);
    }
  }
}
