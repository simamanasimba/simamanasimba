import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMediaHostDto } from "./dto/create-media-host.dto";
import { UpdateMediaHostDto } from "./dto/update-media-host.dto";

@Injectable()
export class MediaHostsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string, mediaOutletId?: string) {
    return this.prisma.mediaHost.findMany({
      where: { organizationId, ...(mediaOutletId ? { mediaOutletId } : {}) },
      orderBy: { name: "asc" },
      include: { _count: { select: { campaignLinks: true } }, mediaOutlet: { select: { id: true, name: true } } },
    });
  }

  create(organizationId: string, dto: CreateMediaHostDto) {
    return this.prisma.mediaHost.create({ data: { organizationId, ...dto } });
  }

  async update(organizationId: string, id: string, dto: UpdateMediaHostDto) {
    await this.ensure(organizationId, id);
    return this.prisma.mediaHost.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    const paymentCount = await this.prisma.payment.count({ where: { mediaHostId: id } });
    if (paymentCount > 0) {
      throw new ConflictException(`Cannot delete — this media host has ${paymentCount} payment record(s). Remove those payments first.`);
    }
    await this.prisma.mediaHost.delete({ where: { id } });
    return { success: true };
  }

  private async ensure(organizationId: string, id: string) {
    const host = await this.prisma.mediaHost.findFirst({ where: { id, organizationId } });
    if (!host) throw new NotFoundException("Media host not found");
    return host;
  }

  async getProfile(organizationId: string, id: string) {
    const host = await this.ensure(organizationId, id);

    const [campaignLinks, entryStats, payments, engagements] = await Promise.all([
      this.prisma.campaignMediaHost.findMany({ where: { mediaHostId: id }, include: { campaign: true } }),
      this.prisma.trackerEntry.findMany({
        where: { mediaHostId: id },
        include: { metric: true, session: { select: { id: true, sessionDate: true, campaignId: true } } },
      }),
      this.prisma.payment.findMany({ where: { mediaHostId: id }, orderBy: { paymentDate: "desc" } }),
      this.prisma.mediaEngagement.findMany({ where: { mediaHostId: id }, orderBy: { createdAt: "desc" } }),
    ]);

    const sessionIds = new Set(entryStats.map((e) => e.session.id));
    const totals: Record<string, number> = {};
    for (const entry of entryStats) {
      if (entry.numericValue == null) continue;
      totals[entry.metric.name] = (totals[entry.metric.name] ?? 0) + Number(entry.numericValue);
    }

    const totalPaid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.paidAmount ?? p.amount), 0);
    // Decimal fields serialize to JSON strings unless converted — fix here so the payment-history
    // table and any campaign totals on the frontend get real numbers, not "50000.00" strings.
    const numericPayments = payments.map((p) => ({ ...p, amount: Number(p.amount), paidAmount: p.paidAmount != null ? Number(p.paidAmount) : null }));
    const numericEngagements = engagements.map((e) => ({ ...e, rateTzs: e.rateTzs != null ? Number(e.rateTzs) : null, totalTzs: e.totalTzs != null ? Number(e.totalTzs) : null }));

    return {
      host,
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
