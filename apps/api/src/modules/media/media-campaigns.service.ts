import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMediaCampaignDto } from "./dto/create-media-campaign.dto";
import { UpdateMediaCampaignDto } from "./dto/update-media-campaign.dto";
import { aggregateByMetric, computePerformanceScore } from "./scoring.util";

@Injectable()
export class MediaCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    const campaigns = await this.prisma.mediaCampaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { mediaHosts: true, influencers: true, sessions: true, payments: true } },
      },
    });
    return Promise.all(
      campaigns.map(async (c) => {
        const paid = await this.prisma.payment.aggregate({ where: { campaignId: c.id, status: "PAID" }, _sum: { amount: true } });
        return { ...c, budget: c.budget != null ? Number(c.budget) : null, totalPaid: Number(paid._sum.amount ?? 0) };
      }),
    );
  }

  async create(organizationId: string, dto: CreateMediaCampaignDto, userId: string) {
    const campaign = await this.prisma.mediaCampaign.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        campaignType: dto.campaignType,
        objective: dto.objective,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status,
        budget: dto.budget,
        ownerUserId: dto.ownerUserId,
        notes: dto.notes,
      },
    });
    // Every campaign starts with one ready-to-use tracking session (today's date) so
    // admins can go straight from setting up hosts/influencers/metrics to entering data,
    // instead of having to remember a separate "create session" step first.
    await this.prisma.trackerSession.create({
      data: { campaignId: campaign.id, sessionDate: new Date(new Date().toISOString().slice(0, 10)), createdByUserId: userId },
    });
    return campaign;
  }

  async ensure(organizationId: string, id: string) {
    const campaign = await this.prisma.mediaCampaign.findFirst({ where: { id, organizationId } });
    if (!campaign) throw new NotFoundException("Media campaign not found");
    return campaign;
  }

  async getById(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    return this.prisma.mediaCampaign.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        mediaHosts: { include: { mediaHost: true } },
        influencers: { include: { influencer: true } },
        metrics: { orderBy: { displayOrder: "asc" } },
        _count: { select: { sessions: true } },
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateMediaCampaignDto) {
    await this.ensure(organizationId, id);
    return this.prisma.mediaCampaign.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async linkMediaHost(organizationId: string, campaignId: string, mediaHostId: string) {
    await this.ensure(organizationId, campaignId);
    const host = await this.prisma.mediaHost.findFirst({ where: { id: mediaHostId, organizationId } });
    if (!host) throw new NotFoundException("Media host not found");
    return this.prisma.campaignMediaHost.upsert({
      where: { campaignId_mediaHostId: { campaignId, mediaHostId } },
      create: { campaignId, mediaHostId },
      update: {},
      include: { mediaHost: true },
    });
  }

  async unlinkMediaHost(organizationId: string, campaignId: string, mediaHostId: string) {
    await this.ensure(organizationId, campaignId);
    await this.prisma.campaignMediaHost.deleteMany({ where: { campaignId, mediaHostId } });
    return { success: true };
  }

  async linkInfluencer(organizationId: string, campaignId: string, influencerId: string) {
    await this.ensure(organizationId, campaignId);
    const influencer = await this.prisma.influencer.findFirst({ where: { id: influencerId, organizationId } });
    if (!influencer) throw new NotFoundException("Influencer not found");
    return this.prisma.campaignInfluencer.upsert({
      where: { campaignId_influencerId: { campaignId, influencerId } },
      create: { campaignId, influencerId },
      update: {},
      include: { influencer: true },
    });
  }

  async unlinkInfluencer(organizationId: string, campaignId: string, influencerId: string) {
    await this.ensure(organizationId, campaignId);
    await this.prisma.campaignInfluencer.deleteMany({ where: { campaignId, influencerId } });
    return { success: true };
  }

  async remove(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    const paymentCount = await this.prisma.payment.count({ where: { campaignId: id } });
    if (paymentCount > 0) {
      throw new ConflictException(`Cannot delete — this campaign has ${paymentCount} payment record(s). Remove those payments first.`);
    }
    await this.prisma.mediaCampaign.delete({ where: { id } });
    return { success: true };
  }

  async getSummary(organizationId: string, campaignId: string) {
    await this.ensure(organizationId, campaignId);
    const [metrics, sessions, entries, hostLinks, influencerLinks] = await Promise.all([
      this.prisma.trackerMetric.findMany({ where: { campaignId }, orderBy: { displayOrder: "asc" } }),
      this.prisma.trackerSession.findMany({ where: { campaignId }, orderBy: { sessionDate: "asc" } }),
      this.prisma.trackerEntry.findMany({ where: { session: { campaignId } } }),
      this.prisma.campaignMediaHost.count({ where: { campaignId } }),
      this.prisma.campaignInfluencer.count({ where: { campaignId } }),
    ]);

    const aggregated = aggregateByMetric(entries, metrics);
    const totals = metrics.map((m) => ({
      metricId: m.id,
      name: m.name,
      unit: m.unit,
      fieldType: m.fieldType,
      value: aggregated.get(m.id) ?? null,
      target: m.target != null ? Number(m.target) : null,
      achievement: m.target != null && aggregated.get(m.id) != null ? (aggregated.get(m.id)! / Number(m.target)) * 100 : null,
    }));

    // Daily trend per session, for the metrics that participate in scoring (keeps the payload small).
    const scoringMetricIds = new Set(metrics.filter((m) => m.scoringEnabled).map((m) => m.id));
    const trend = sessions.map((s) => {
      const sessionEntries = entries.filter((e) => e.sessionId === s.id);
      const sessionAgg = aggregateByMetric(sessionEntries, metrics.filter((m) => scoringMetricIds.has(m.id)));
      const point: Record<string, number | string> = { date: s.sessionDate.toISOString().slice(0, 10) };
      for (const m of metrics) if (sessionAgg.has(m.id)) point[m.name] = sessionAgg.get(m.id)!;
      return point;
    });

    return {
      campaignId,
      totalSessions: sessions.length,
      mediaHostCount: hostLinks,
      influencerCount: influencerLinks,
      metricTotals: totals,
      performanceScore: computePerformanceScore(aggregated, metrics),
      trend,
    };
  }

  async getFinancialSummary(organizationId: string, campaignId: string) {
    const campaign = await this.ensure(organizationId, campaignId);
    const [paid, count] = await Promise.all([
      this.prisma.payment.aggregate({ where: { campaignId, status: "PAID" }, _sum: { amount: true } }),
      this.prisma.payment.count({ where: { campaignId } }),
    ]);
    const totalPaid = Number(paid._sum.amount ?? 0);
    const budget = campaign.budget != null ? Number(campaign.budget) : null;
    return {
      budget,
      totalPaid,
      remaining: budget != null ? budget - totalPaid : null,
      paymentCount: count,
    };
  }

  async getHostComparison(organizationId: string, campaignId: string) {
    await this.ensure(organizationId, campaignId);
    const [links, metrics] = await Promise.all([
      this.prisma.campaignMediaHost.findMany({ where: { campaignId }, include: { mediaHost: true } }),
      this.prisma.trackerMetric.findMany({ where: { campaignId } }),
    ]);

    return Promise.all(
      links.map(async (link) => {
        const entries = await this.prisma.trackerEntry.findMany({ where: { session: { campaignId }, mediaHostId: link.mediaHostId } });
        const sessionCount = new Set(entries.map((e) => e.sessionId)).size;
        const aggregated = aggregateByMetric(entries, metrics);
        return {
          mediaHost: link.mediaHost,
          sessionCount,
          metricTotals: Object.fromEntries(metrics.map((m) => [m.name, aggregated.get(m.id) ?? null])),
          performanceScore: computePerformanceScore(aggregated, metrics),
        };
      }),
    );
  }

  async getInfluencerComparison(organizationId: string, campaignId: string) {
    await this.ensure(organizationId, campaignId);
    const [links, metrics] = await Promise.all([
      this.prisma.campaignInfluencer.findMany({ where: { campaignId }, include: { influencer: true } }),
      this.prisma.trackerMetric.findMany({ where: { campaignId } }),
    ]);

    return Promise.all(
      links.map(async (link) => {
        const entries = await this.prisma.trackerEntry.findMany({ where: { session: { campaignId }, influencerId: link.influencerId } });
        const sessionCount = new Set(entries.map((e) => e.sessionId)).size;
        const aggregated = aggregateByMetric(entries, metrics);
        return {
          influencer: link.influencer,
          sessionCount,
          metricTotals: Object.fromEntries(metrics.map((m) => [m.name, aggregated.get(m.id) ?? null])),
          performanceScore: computePerformanceScore(aggregated, metrics),
        };
      }),
    );
  }
}
