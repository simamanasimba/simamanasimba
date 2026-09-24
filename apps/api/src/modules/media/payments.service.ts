import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaymentBeneficiaryType, PaymentStatus, Prisma } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { BulkCreatePaymentDto } from "./dto/bulk-create-payment.dto";

export interface PaymentFilters {
  campaignId?: string;
  beneficiaryType?: PaymentBeneficiaryType;
  mediaHostId?: string;
  influencerId?: string;
  memberId?: string;
  status?: PaymentStatus;
  method?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(organizationId: string, filters: PaymentFilters): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = {
      organizationId,
      campaignId: filters.campaignId,
      beneficiaryType: filters.beneficiaryType,
      mediaHostId: filters.mediaHostId,
      influencerId: filters.influencerId,
      memberId: filters.memberId,
      status: filters.status,
      method: filters.method,
    };
    if (filters.dateFrom || filters.dateTo) {
      where.paymentDate = {
        gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        lte: filters.dateTo ? new Date(filters.dateTo) : undefined,
      };
    }
    return where;
  }

  async list(organizationId: string, filters: PaymentFilters) {
    const payments = await this.prisma.payment.findMany({
      where: this.buildWhere(organizationId, filters),
      include: { campaign: { select: { id: true, name: true } }, mediaHost: true, influencer: true, member: true, mediaEngagement: true },
      orderBy: { paymentDate: "desc" },
    });

    // createdByUserId/approvedByUserId/rejectedByUserId are plain columns (no Prisma relation —
    // same isolation choice used elsewhere in this schema), so names are resolved with one
    // extra lookup here rather than a join.
    const userIds = Array.from(
      new Set(payments.flatMap((p) => [p.createdByUserId, p.approvedByUserId, p.rejectedByUserId]).filter((id): id is string => Boolean(id))),
    );
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
    const nameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    // Prisma's Decimal serializes to a JSON string (decimal.js deliberately avoids lossy numeric
    // coercion) — left unconverted, `amount` arrives on the frontend as e.g. "50000.00" and any
    // `sum + p.amount` silently string-concatenates instead of adding. Convert every Decimal field
    // here, at the source, so every caller of this endpoint gets real numbers.
    return payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      paidAmount: p.paidAmount != null ? Number(p.paidAmount) : null,
      createdByName: nameById.get(p.createdByUserId) ?? null,
      approvedByName: p.approvedByUserId ? (nameById.get(p.approvedByUserId) ?? null) : null,
      rejectedByName: p.rejectedByUserId ? (nameById.get(p.rejectedByUserId) ?? null) : null,
      mediaEngagement: p.mediaEngagement
        ? { ...p.mediaEngagement, rateTzs: p.mediaEngagement.rateTzs != null ? Number(p.mediaEngagement.rateTzs) : null, totalTzs: p.mediaEngagement.totalTzs != null ? Number(p.mediaEngagement.totalTzs) : null }
        : p.mediaEngagement,
    }));
  }

  async create(organizationId: string, dto: CreatePaymentDto, userId: string) {
    if (dto.beneficiaryType === "MEDIA_HOST" && !dto.mediaHostId) throw new BadRequestException("mediaHostId is required for a media host payment");
    if (dto.beneficiaryType === "INFLUENCER" && !dto.influencerId) throw new BadRequestException("influencerId is required for an influencer payment");
    if (dto.beneficiaryType === "MEMBER" && !dto.memberId) throw new BadRequestException("memberId is required for a member payment");

    if (dto.mediaEngagementId) {
      const engagement = await this.prisma.mediaEngagement.findFirst({ where: { id: dto.mediaEngagementId, organizationId } });
      if (!engagement) throw new BadRequestException("Campaign not found");
      if (engagement.status === "PAID") throw new BadRequestException("This campaign has already been paid");
      const inFlight = await this.prisma.payment.findFirst({ where: { mediaEngagementId: dto.mediaEngagementId, status: { in: ["PENDING", "PROCESSING"] } } });
      if (inFlight) throw new BadRequestException("This campaign already has a payment in progress");
    }
    if (dto.influencer2CampaignId) {
      const campaign = await this.prisma.influencer2Campaign.findFirst({ where: { id: dto.influencer2CampaignId, organizationId } });
      if (!campaign) throw new BadRequestException("Campaign not found");
      if (campaign.paymentStatus === "PAID") throw new BadRequestException("This campaign has already been paid");
      const inFlight = await this.prisma.payment.findFirst({ where: { influencer2CampaignId: dto.influencer2CampaignId, status: { in: ["PENDING", "PROCESSING"] } } });
      if (inFlight) throw new BadRequestException("This campaign already has a payment in progress");
    }

    // Always created PENDING — never PAID directly from client input. Becomes PAID (and flips
    // the linked campaign's own payment status) only through approve() below.
    return this.prisma.payment.create({
      data: {
        organizationId,
        campaignId: dto.campaignId,
        beneficiaryType: dto.beneficiaryType,
        mediaHostId: dto.beneficiaryType === "MEDIA_HOST" ? dto.mediaHostId : undefined,
        influencerId: dto.beneficiaryType === "INFLUENCER" ? dto.influencerId : undefined,
        memberId: dto.beneficiaryType === "MEMBER" ? dto.memberId : undefined,
        paymentDate: new Date(dto.paymentDate),
        amount: dto.amount,
        currency: dto.currency,
        method: dto.method,
        referenceNumber: dto.referenceNumber,
        description: dto.description,
        status: "PENDING",
        documentUrl: dto.documentUrl,
        notes: dto.notes,
        bankName: dto.bankName,
        bankAccountName: dto.bankAccountName,
        bankAccountNumber: dto.bankAccountNumber,
        bankTransactionRef: dto.bankTransactionRef,
        mobileMoneyProvider: dto.mobileMoneyProvider,
        mobileMoneyNumber: dto.mobileMoneyNumber,
        mobileMoneyTransactionId: dto.mobileMoneyTransactionId,
        mediaEngagementId: dto.mediaEngagementId,
        influencer2CampaignId: dto.influencer2CampaignId,
        createdByUserId: userId,
      },
    });
  }

  /** Approves a pending payment: this authorizes it FOR Finance to pay — it does not mean paid.
   * Moves it to PROCESSING ("Pending Payment") and records who/when approved it. The linked
   * campaign only flips to PAID once Finance actually records the payment — see markPaid()
   * below. Admin approving and Finance paying are deliberately two different actions; approving
   * never sets a payment method, since the admin isn't the one making the payment. */
  async approve(organizationId: string, paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, organizationId } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== "PENDING") throw new ForbiddenException("Only a payment awaiting approval can be approved");
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: "PROCESSING", approvedByUserId: userId, approvedAt: new Date() },
    });
  }

  async reject(organizationId: string, paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, organizationId } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== "PENDING") throw new ForbiddenException("Only a payment awaiting approval can be rejected");
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: "REJECTED", rejectedByUserId: userId, rejectedAt: new Date() },
    });
  }

  /** Finance's own step: records how the money was actually sent and marks the payment PAID.
   * Only now does the linked campaign/engagement flip to paid — this is the one place that
   * happens, so a payment an admin approved but Finance hasn't paid yet never shows as "Paid"
   * anywhere. `paidAmount` can legitimately differ from the admin-approved `amount` (e.g. a
   * partial payment, or a correction) — when it does, `varianceNote` is required so there's
   * always a reason on record for the gap. */
  async markPaid(organizationId: string, paymentId: string, method?: string, referenceNumber?: string, paidAmount?: number, varianceNote?: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, organizationId } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== "PROCESSING") throw new ForbiddenException("Only an approved payment awaiting payment can be marked paid");

    const approvedAmount = Number(payment.amount);
    const finalPaidAmount = paidAmount ?? approvedAmount;
    if (finalPaidAmount !== approvedAmount && !varianceNote?.trim()) {
      throw new BadRequestException("The paid amount is different from the approved amount — please explain why");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "PAID",
          method: method ?? payment.method,
          referenceNumber: referenceNumber ?? payment.referenceNumber,
          paidAmount: finalPaidAmount,
          amountVarianceNote: finalPaidAmount !== approvedAmount ? varianceNote!.trim() : null,
        },
      });
      if (payment.mediaEngagementId) {
        await tx.mediaEngagement.update({ where: { id: payment.mediaEngagementId }, data: { status: "PAID" } });
      }
      if (payment.influencer2CampaignId) {
        await tx.influencer2Campaign.update({ where: { id: payment.influencer2CampaignId }, data: { paymentStatus: "PAID" } });
      }
      return result;
    });

    // Every other read path (list()) converts Decimal -> number before it ever reaches the
    // frontend — this one skipped that, so a client that trusts this response's amount/paidAmount
    // as numbers (e.g. calling .toLocaleString() or doing arithmetic) got a Decimal object instead.
    return { ...updated, amount: Number(updated.amount), paidAmount: updated.paidAmount != null ? Number(updated.paidAmount) : null };
  }

  async setAttachment(organizationId: string, paymentId: string, documentUrl: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, organizationId } });
    if (!payment) throw new NotFoundException("Payment not found");
    return this.prisma.payment.update({ where: { id: paymentId }, data: { documentUrl } });
  }

  /** Creates one Payment row per entry — the "select a group, key in an amount for each" bulk-pay flow. */
  async createBulk(organizationId: string, dto: BulkCreatePaymentDto, userId: string) {
    const data = dto.entries.map((entry) => ({
      organizationId,
      campaignId: dto.campaignId,
      beneficiaryType: dto.beneficiaryType,
      mediaHostId: dto.beneficiaryType === "MEDIA_HOST" ? entry.beneficiaryId : undefined,
      influencerId: dto.beneficiaryType === "INFLUENCER" ? entry.beneficiaryId : undefined,
      memberId: dto.beneficiaryType === "MEMBER" ? entry.beneficiaryId : undefined,
      paymentDate: new Date(dto.paymentDate),
      amount: entry.amount,
      currency: dto.currency,
      method: dto.method,
      description: dto.description,
      createdByUserId: userId,
    }));
    await this.prisma.payment.createMany({ data });
    return { created: data.length };
  }

  async getFinanceDashboard(organizationId: string) {
    const now = new Date();
    const startOfToday = new Date(now.toISOString().slice(0, 10));
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, week, month, total, pendingCount, paymentCount, byCampaign, byMediaHost, byInfluencer, byMember, memberPayments, meetingBudgets, expensesByCategory] = await Promise.all([
      this.prisma.payment.aggregate({ where: { organizationId, status: "PAID", paymentDate: { gte: startOfToday } }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { organizationId, status: "PAID", paymentDate: { gte: startOfWeek } }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { organizationId, status: "PAID", paymentDate: { gte: startOfMonth } }, _sum: { amount: true } }),
      // Every PAID payment regardless of beneficiary type — media + influencer + member(leader)
      // spend, each counted here exactly once (not also re-added per-category below).
      this.prisma.payment.aggregate({ where: { organizationId, status: "PAID" }, _sum: { amount: true } }),
      this.prisma.payment.count({ where: { organizationId, status: { in: ["PENDING", "PROCESSING"] } } }),
      this.prisma.payment.count({ where: { organizationId } }),
      this.prisma.payment.groupBy({ by: ["campaignId"], where: { organizationId, status: "PAID", campaignId: { not: null } }, _sum: { amount: true } }),
      this.prisma.payment.groupBy({ by: ["mediaHostId"], where: { organizationId, status: "PAID", mediaHostId: { not: null } }, _sum: { amount: true } }),
      this.prisma.payment.groupBy({ by: ["influencerId"], where: { organizationId, status: "PAID", influencerId: { not: null } }, _sum: { amount: true } }),
      this.prisma.payment.groupBy({ by: ["memberId"], where: { organizationId, status: "PAID", memberId: { not: null } }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { organizationId, status: "PAID", beneficiaryType: "MEMBER" }, _sum: { amount: true } }),
      // Meeting budgets are planned/allocated costs, not payments — there's no separate "meeting
      // expense" record, so the budget figure itself is the closest thing to a cost for a meeting.
      this.prisma.event.aggregate({ where: { organizationId, budget: { not: null } }, _sum: { budget: true } }),
      this.prisma.expense.groupBy({ by: ["category"], where: { organizationId }, _sum: { totalCost: true } }),
    ]);

    const operationalSpend = Number(expensesByCategory.find((r) => r.category === "OPERATIONAL")?._sum.totalCost ?? 0);
    const administrativeSpend = Number(expensesByCategory.find((r) => r.category === "ADMINISTRATIVE")?._sum.totalCost ?? 0);
    const meetingSpend = Number(meetingBudgets._sum.budget ?? 0);

    const [campaigns, mediaHosts, influencers, members] = await Promise.all([
      this.prisma.mediaCampaign.findMany({ where: { organizationId }, select: { id: true, name: true } }),
      this.prisma.mediaHost.findMany({ where: { organizationId }, select: { id: true, name: true } }),
      this.prisma.influencer.findMany({ where: { organizationId }, select: { id: true, name: true } }),
      this.prisma.member.findMany({ where: { organizationId }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));
    const hostName = new Map(mediaHosts.map((h) => [h.id, h.name]));
    const influencerName = new Map(influencers.map((i) => [i.id, i.name]));
    const memberName = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));

    return {
      todaySpend: Number(today._sum.amount ?? 0),
      weekSpend: Number(week._sum.amount ?? 0),
      monthSpend: Number(month._sum.amount ?? 0),
      // Every category counted exactly once: `total` already covers media + influencer +
      // member(leader) payments together (a blanket PAID-payments sum, no beneficiaryType
      // filter), plus operational/administrative expenses and the meeting budget total — none of
      // these overlap, unlike the old memberSpendBreakdown which used to fold media/influencer
      // payment costs back into "member spend" too, on top of their own separate tiles.
      totalSpend: Number(total._sum.amount ?? 0) + operationalSpend + administrativeSpend + meetingSpend,
      paymentCount,
      pendingCount,
      spendByCampaign: byCampaign.map((r) => ({ campaignId: r.campaignId, name: campaignName.get(r.campaignId!) ?? "—", amount: Number(r._sum.amount ?? 0) })),
      spendByMediaHost: byMediaHost.map((r) => ({ mediaHostId: r.mediaHostId, name: hostName.get(r.mediaHostId!) ?? "—", amount: Number(r._sum.amount ?? 0) })),
      spendByInfluencer: byInfluencer.map((r) => ({ influencerId: r.influencerId, name: influencerName.get(r.influencerId!) ?? "—", amount: Number(r._sum.amount ?? 0) })),
      spendByMember: byMember.map((r) => ({ memberId: r.memberId, name: memberName.get(r.memberId!) ?? "—", amount: Number(r._sum.amount ?? 0) })),
      // Member ("leader") payments — just that, no longer folded together with meeting budgets or
      // media/influencer costs (those already have their own tiles).
      leaderSpend: Number(memberPayments._sum.amount ?? 0),
      // The allocated budget total across every event with one set — the closest available figure
      // to "meeting cost" without a per-event expense record to sum instead. Its own tile now,
      // separate from member/leader payments.
      meetingSpend,
      operationalSpend,
      administrativeSpend,
    };
  }
}
