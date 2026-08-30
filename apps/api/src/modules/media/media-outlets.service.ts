import { Injectable, NotFoundException } from "@nestjs/common";
import type { MediaHostType } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMediaOutletDto } from "./dto/create-media-outlet.dto";
import { CATALOG_TYPE_MAP, loadMediaCatalog } from "./media-catalog.util";

/** The "Media House" level of the Media -> Channel -> Kipindi cascade used when registering a
 * MediaHost. `list`/`catalogFor` below serve the CREATE FORM's dropdown suggestions from the
 * seeded reference catalog (see MediaCatalogSeedService) — this is deliberately just suggestion
 * data, never treated as "active"/"in use" media anywhere else in the app. Whether a media house
 * is actually in use is answered elsewhere (MediaEngagementOverviewService), by checking for a
 * real MediaHost row, never by this table alone. */
@Injectable()
export class MediaOutletsService {
  constructor(private readonly prisma: PrismaService) {}

  /** When `type` is given, only outlets whose catalog entry actually has a channel of that type
   * are offered — e.g. picking "RADIO" hides TV-only media houses. An outlet an admin created by
   * hand (no externalId, so no catalog entry to check) is excluded from a type-filtered list —
   * it can still be picked with no type filter, or once it has a real host of that type. */
  async list(organizationId: string, type?: MediaHostType) {
    const outlets = await this.prisma.mediaOutlet.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    });
    if (!type) return outlets;

    const catalog = loadMediaCatalog();
    const matchingHouseIds = new Set(
      catalog?.media_houses.filter((h) => h.channels.some((c) => CATALOG_TYPE_MAP[c.type] === type)).map((h) => h.id) ?? [],
    );
    const registeredIds = new Set(
      (await this.prisma.mediaHost.findMany({ where: { organizationId, type, mediaOutletId: { not: null } }, select: { mediaOutletId: true } })).map(
        (h) => h.mediaOutletId as string,
      ),
    );
    return outlets.filter((o) => (o.externalId && matchingHouseIds.has(o.externalId)) || registeredIds.has(o.id));
  }

  create(organizationId: string, dto: CreateMediaOutletDto) {
    return this.prisma.mediaOutlet.upsert({
      where: { organizationId_name: { organizationId, name: dto.name } },
      create: { organizationId, name: dto.name },
      update: {},
    });
  }

  /** Channel + Kipindi/session suggestions for one outlet's dropdown — from the reference
   * catalog when this outlet came from there (e.g. Wasafi Media -> Wasafi FM -> Mashamsham,
   * available immediately, before anyone has registered a single host), PLUS any channel/program
   * names this org has already typed for real hosts under this outlet (so a manually-added value
   * becomes a suggestion for the next host too). `type` narrows catalog channels to that type. */
  async catalogFor(organizationId: string, mediaOutletId: string, type?: MediaHostType) {
    const outlet = await this.prisma.mediaOutlet.findFirst({ where: { id: mediaOutletId, organizationId } });
    if (!outlet) throw new NotFoundException("Media outlet not found");

    const channels = new Map<string, Set<string>>();

    if (outlet.externalId) {
      const catalog = loadMediaCatalog();
      const house = catalog?.media_houses.find((h) => h.id === outlet.externalId);
      for (const c of house?.channels ?? []) {
        if (type && CATALOG_TYPE_MAP[c.type] !== type) continue;
        if (!channels.has(c.name)) channels.set(c.name, new Set());
        for (const p of c.programs ?? []) channels.get(c.name)!.add(p.name);
      }
    }

    const registeredHosts = await this.prisma.mediaHost.findMany({
      where: { organizationId, mediaOutletId, ...(type ? { type } : {}) },
      select: { channelName: true, programName: true },
    });
    for (const h of registeredHosts) {
      if (!h.channelName) continue;
      if (!channels.has(h.channelName)) channels.set(h.channelName, new Set());
      if (h.programName) channels.get(h.channelName)!.add(h.programName);
    }

    return {
      channels: Array.from(channels.entries()).map(([name, programs]) => ({ name, programs: Array.from(programs) })),
    };
  }
}
