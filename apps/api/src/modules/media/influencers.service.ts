import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateInfluencerDto } from "./dto/create-influencer.dto";
import { UpdateInfluencerDto } from "./dto/update-influencer.dto";

@Injectable()
export class InfluencersService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.influencer.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: { _count: { select: { campaignLinks: true } } },
    });
  }

  create(organizationId: string, dto: CreateInfluencerDto) {
    return this.prisma.influencer.create({ data: { organizationId, ...dto, contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : undefined } });
  }

  async update(organizationId: string, id: string, dto: UpdateInfluencerDto) {
    await this.ensure(organizationId, id);
    return this.prisma.influencer.update({ where: { id }, data: { ...dto, contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : undefined } });
  }

  async remove(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    const paymentCount = await this.prisma.payment.count({ where: { influencerId: id } });
    if (paymentCount > 0) {
      throw new ConflictException(`Cannot delete — this influencer has ${paymentCount} payment record(s). Remove those payments first.`);
    }
    await this.prisma.influencer.delete({ where: { id } });
    return { success: true };
  }

  private async ensure(organizationId: string, id: string) {
    const influencer = await this.prisma.influencer.findFirst({ where: { id, organizationId } });
    if (!influencer) throw new NotFoundException("Influencer not found");
    return influencer;
  }

  async setAgreement(organizationId: string, id: string, agreementUrl: string) {
    await this.ensure(organizationId, id);
    return this.prisma.influencer.update({ where: { id }, data: { agreementUrl } });
  }

  async getProfile(organizationId: string, id: string) {
    const influencer = await this.ensure(organizationId, id);

    const [campaignLinks, entryStats, payments, engagements] = await Promise.all([
      this.prisma.campaignInfluencer.findMany({ where: { influencerId: id }, include: { campaign: true } }),
      this.prisma.trackerEntry.findMany({
        where: { influencerId: id },
        include: { metric: true, session: { select: { id: true, sessionDate: true, campaignId: true } } },
      }),
      this.prisma.payment.findMany({ where: { influencerId: id }, orderBy: { paymentDate: "desc" } }),
      this.prisma.mediaEngagement.findMany({ where: { influencerId: id }, orderBy: { createdAt: "desc" } }),
    ]);

    const sessionIds = new Set(entryStats.map((e) => e.session.id));
    const totals: Record<string, number> = {};
    for (const entry of entryStats) {
      if (entry.numericValue == null) continue;
      totals[entry.metric.name] = (totals[entry.metric.name] ?? 0) + Number(entry.numericValue);
    }

    const totalPaid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.paidAmount ?? p.amount), 0);
    const numericPayments = payments.map((p) => ({ ...p, amount: Number(p.amount), paidAmount: p.paidAmount != null ? Number(p.paidAmount) : null }));
    const numericEngagements = engagements.map((e) => ({ ...e, rateTzs: e.rateTzs != null ? Number(e.rateTzs) : null, totalTzs: e.totalTzs != null ? Number(e.totalTzs) : null }));

    return {
      influencer,
      campaigns: campaignLinks.map((l) => l.campaign),
      totalSessions: sessionIds.size,
      metricTotals: totals,
      payments: numericPayments,
      totalPaid,
      paymentCount: payments.length,
      lastPayment: numericPayments[0] ?? null,
      engagements: numericEngagements,
    };
  }
}
