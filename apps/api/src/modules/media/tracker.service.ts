import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { TrackerSessionStatus } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTrackerMetricDto } from "./dto/create-tracker-metric.dto";
import { UpdateTrackerMetricDto } from "./dto/update-tracker-metric.dto";
import { CreateSessionDto } from "./dto/create-session.dto";
import { BulkEntriesDto } from "./dto/bulk-entries.dto";

@Injectable()
export class TrackerService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureCampaign(organizationId: string, campaignId: string) {
    const campaign = await this.prisma.mediaCampaign.findFirst({ where: { id: campaignId, organizationId } });
    if (!campaign) throw new NotFoundException("Media campaign not found");
    return campaign;
  }

  // ── Metrics ──────────────────────────────────────────────────────────────

  async listMetrics(organizationId: string, campaignId: string) {
    await this.ensureCampaign(organizationId, campaignId);
    return this.prisma.trackerMetric.findMany({ where: { campaignId }, orderBy: { displayOrder: "asc" } });
  }

  async createMetric(organizationId: string, campaignId: string, dto: CreateTrackerMetricDto) {
    await this.ensureCampaign(organizationId, campaignId);
    return this.prisma.trackerMetric.create({ data: { campaignId, ...dto } });
  }

  async updateMetric(organizationId: string, campaignId: string, metricId: string, dto: UpdateTrackerMetricDto) {
    await this.ensureMetric(organizationId, campaignId, metricId);
    return this.prisma.trackerMetric.update({ where: { id: metricId }, data: dto });
  }

  async deleteMetric(organizationId: string, campaignId: string, metricId: string) {
    await this.ensureMetric(organizationId, campaignId, metricId);
    await this.prisma.trackerMetric.delete({ where: { id: metricId } });
    return { success: true };
  }

  private async ensureMetric(organizationId: string, campaignId: string, metricId: string) {
    await this.ensureCampaign(organizationId, campaignId);
    const metric = await this.prisma.trackerMetric.findFirst({ where: { id: metricId, campaignId } });
    if (!metric) throw new NotFoundException("Metric not found");
    return metric;
  }

  // ── Sessions ─────────────────────────────────────────────────────────────

  async listSessions(organizationId: string, campaignId: string) {
    await this.ensureCampaign(organizationId, campaignId);
    const sessions = await this.prisma.trackerSession.findMany({
      where: { campaignId },
      orderBy: { sessionDate: "desc" },
      include: { _count: { select: { entries: true } } },
    });
    return sessions;
  }

  /** Creates today's (or a given date's) session, pre-loaded with the campaign's configured metrics and linked hosts/influencers — the "+ Add Tracker Session" action. Idempotent: re-clicking for a date that already has a session just returns it. */
  async createSession(organizationId: string, campaignId: string, dto: CreateSessionDto, userId: string) {
    await this.ensureCampaign(organizationId, campaignId);
    const sessionDate = dto.sessionDate ? new Date(dto.sessionDate) : new Date(new Date().toISOString().slice(0, 10));

    const existing = await this.prisma.trackerSession.findUnique({ where: { campaignId_sessionDate: { campaignId, sessionDate } } });
    if (existing) return this.getSessionDetail(organizationId, campaignId, existing.id);

    const session = await this.prisma.trackerSession.create({ data: { campaignId, sessionDate, createdByUserId: userId } });
    return this.getSessionDetail(organizationId, campaignId, session.id);
  }

  async getSessionDetail(organizationId: string, campaignId: string, sessionId: string) {
    await this.ensureCampaign(organizationId, campaignId);
    const session = await this.prisma.trackerSession.findFirst({ where: { id: sessionId, campaignId } });
    if (!session) throw new NotFoundException("Tracker session not found");

    const [metrics, hostLinks, influencerLinks, entries] = await Promise.all([
      this.prisma.trackerMetric.findMany({ where: { campaignId }, orderBy: { displayOrder: "asc" } }),
      this.prisma.campaignMediaHost.findMany({ where: { campaignId }, include: { mediaHost: true } }),
      this.prisma.campaignInfluencer.findMany({ where: { campaignId }, include: { influencer: true } }),
      this.prisma.trackerEntry.findMany({ where: { sessionId } }),
    ]);

    return {
      session,
      metrics,
      mediaHosts: hostLinks.map((l) => l.mediaHost),
      influencers: influencerLinks.map((l) => l.influencer),
      entries,
    };
  }

  async updateSessionStatus(organizationId: string, campaignId: string, sessionId: string, status: TrackerSessionStatus, userId: string) {
    await this.ensureCampaign(organizationId, campaignId);
    const session = await this.prisma.trackerSession.findFirst({ where: { id: sessionId, campaignId } });
    if (!session) throw new NotFoundException("Tracker session not found");
    return this.prisma.trackerSession.update({ where: { id: sessionId }, data: { status, updatedByUserId: userId } });
  }

  /** Matrix save — upserts every cell the user filled in for this session in one call. Rejects writes to a locked session. */
  async saveEntries(organizationId: string, campaignId: string, sessionId: string, dto: BulkEntriesDto, userId: string) {
    await this.ensureCampaign(organizationId, campaignId);
    const session = await this.prisma.trackerSession.findFirst({ where: { id: sessionId, campaignId } });
    if (!session) throw new NotFoundException("Tracker session not found");
    if (session.status === "LOCKED") throw new ForbiddenException("This tracker session is locked");

    const saved: Awaited<ReturnType<typeof this.prisma.trackerEntry.upsert>>[] = [];
    for (const entry of dto.entries) {
      const subjectId = entry.mediaHostId || entry.influencerId;
      if (!subjectId) throw new ConflictException("Each entry needs a mediaHostId or influencerId");

      const row = await this.prisma.trackerEntry.upsert({
        where: { sessionId_metricId_subjectId: { sessionId, metricId: entry.metricId, subjectId } },
        create: {
          sessionId,
          metricId: entry.metricId,
          subjectType: entry.subjectType,
          subjectId,
          mediaHostId: entry.mediaHostId,
          influencerId: entry.influencerId,
          numericValue: entry.numericValue,
          textValue: entry.textValue,
          boolValue: entry.boolValue,
        },
        update: {
          numericValue: entry.numericValue,
          textValue: entry.textValue,
          boolValue: entry.boolValue,
        },
      });
      saved.push(row);
    }
    await this.prisma.trackerSession.update({ where: { id: sessionId }, data: { updatedByUserId: userId } });
    return saved;
  }
}
