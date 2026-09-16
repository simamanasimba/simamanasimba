import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaymentBeneficiaryType, PostingAgreementEngagementMetric, Prisma } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { Influencer2CampaignsService } from "../influencer2/influencer2-campaigns.service";
import { CreatePostingAgreementDto } from "./dto/create-posting-agreement.dto";
import { UpdatePostingAgreementDto } from "./dto/update-posting-agreement.dto";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toNumericAgreement<T extends { weeklyAmount: Prisma.Decimal }>(agreement: T) {
  return { ...agreement, weeklyAmount: Number(agreement.weeklyAmount) };
}

@Injectable()
export class PostingAgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: Influencer2CampaignsService,
  ) {}

  private validateTarget(dto: { mediaHostId?: string; influencerId?: string; targetType: string; postsPerWeek?: number; engagementMetric?: string; engagementTarget?: number }) {
    if (Boolean(dto.mediaHostId) === Boolean(dto.influencerId)) {
      throw new BadRequestException("An agreement belongs to exactly one media host or one influencer");
    }
    if (dto.targetType === "POST_COUNT" && !dto.postsPerWeek) {
      throw new BadRequestException("postsPerWeek is required for a post-count agreement");
    }
    if (dto.targetType === "ENGAGEMENT" && (!dto.engagementMetric || !dto.engagementTarget)) {
      throw new BadRequestException("engagementMetric and engagementTarget are required for an engagement agreement");
    }
  }

  private async ensure(organizationId: string, id: string) {
    const agreement = await this.prisma.postingAgreement.findFirst({ where: { id, organizationId } });
    if (!agreement) throw new NotFoundException("Posting agreement not found");
    return agreement;
  }

  async list(organizationId: string, filters: { mediaHostId?: string; influencerId?: string }) {
    const rows = await this.prisma.postingAgreement.findMany({
      where: { organizationId, mediaHostId: filters.mediaHostId, influencerId: filters.influencerId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toNumericAgreement);
  }

  async create(organizationId: string, dto: CreatePostingAgreementDto, userId: string) {
    this.validateTarget(dto);
    const row = await this.prisma.postingAgreement.create({
      data: {
        organizationId,
        mediaHostId: dto.mediaHostId,
        influencerId: dto.influencerId,
        targetType: dto.targetType,
        postsPerWeek: dto.targetType === "POST_COUNT" ? dto.postsPerWeek : undefined,
        engagementMetric: dto.targetType === "ENGAGEMENT" ? dto.engagementMetric : undefined,
        engagementTarget: dto.targetType === "ENGAGEMENT" ? dto.engagementTarget : undefined,
        weeklyAmount: dto.weeklyAmount,
        currency: dto.currency ?? "TZS",
        notes: dto.notes,
        createdByUserId: userId,
      },
    });
    return toNumericAgreement(row);
  }

  async update(organizationId: string, id: string, dto: UpdatePostingAgreementDto) {
    const existing = await this.ensure(organizationId, id);
    const merged = {
      mediaHostId: dto.mediaHostId ?? existing.mediaHostId ?? undefined,
      influencerId: dto.influencerId ?? existing.influencerId ?? undefined,
      targetType: dto.targetType ?? existing.targetType,
      postsPerWeek: dto.postsPerWeek ?? existing.postsPerWeek ?? undefined,
      engagementMetric: dto.engagementMetric ?? existing.engagementMetric ?? undefined,
      engagementTarget: dto.engagementTarget ?? existing.engagementTarget ?? undefined,
    };
    this.validateTarget(merged);
    const row = await this.prisma.postingAgreement.update({
      where: { id },
      data: {
        targetType: dto.targetType,
        postsPerWeek: dto.targetType ? (dto.targetType === "POST_COUNT" ? dto.postsPerWeek : null) : dto.postsPerWeek,
        engagementMetric: dto.targetType ? (dto.targetType === "ENGAGEMENT" ? dto.engagementMetric : null) : dto.engagementMetric,
        engagementTarget: dto.targetType ? (dto.targetType === "ENGAGEMENT" ? dto.engagementTarget : null) : dto.engagementTarget,
        weeklyAmount: dto.weeklyAmount,
        currency: dto.currency,
        notes: dto.notes,
        isActive: dto.isActive,
      },
    });
    return toNumericAgreement(row);
  }

  async remove(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    await this.prisma.postingAgreement.delete({ where: { id } });
    return { success: true };
  }

  private pickEngagementValue(summary: { totalViews: number | null; totalLikes: number | null; totalComments: number | null; totalShares: number | null; totalEngagement: number }, metric: PostingAgreementEngagementMetric) {
    switch (metric) {
      case "VIEWS":
        return summary.totalViews ?? 0;
      case "LIKES":
        return summary.totalLikes ?? 0;
      case "COMMENTS":
        return summary.totalComments ?? 0;
      case "SHARES":
        return summary.totalShares ?? 0;
      case "TOTAL_ENGAGEMENT":
        return summary.totalEngagement;
    }
  }

  /** Computes (and stores) one week's actual posts/engagement for this agreement's beneficiary,
   * reusing the same Influencer2Campaign aggregation the Media/Influencer dashboards already use —
   * there's no separate "posting agreement" data source, just a target compared against the real
   * numbers. Re-evaluating an already-evaluated week returns the stored result unchanged rather
   * than silently recomputing it, so a week that already has a payment ticket can't drift. */
  async evaluateWeek(organizationId: string, agreementId: string, weekStartStr: string, userId: string) {
    const agreement = await this.ensure(organizationId, agreementId);
    const weekStart = new Date(`${weekStartStr}T00:00:00.000Z`);
    const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY - 1);

    const existing = await this.prisma.postingAgreementEvaluation.findUnique({
      where: { agreementId_weekStart: { agreementId, weekStart } },
    });
    if (existing) return existing;

    const summary = await this.campaigns.summary(organizationId, {
      mediaHostId: agreement.mediaHostId ?? undefined,
      influencerId: agreement.influencerId ?? undefined,
      from: weekStart,
      to: weekEnd,
    });

    const actualPostCount = summary.totalPosts;
    let actualEngagement: number | null = null;
    let targetMet: boolean;
    if (agreement.targetType === "POST_COUNT") {
      targetMet = actualPostCount >= (agreement.postsPerWeek ?? 0);
    } else {
      actualEngagement = this.pickEngagementValue(summary, agreement.engagementMetric!);
      targetMet = actualEngagement >= (agreement.engagementTarget ?? 0);
    }

    return this.prisma.postingAgreementEvaluation.create({
      data: { agreementId, weekStart, weekEnd, actualPostCount, actualEngagement, targetMet, evaluatedByUserId: userId },
    });
  }

  async listEvaluations(organizationId: string, agreementId: string) {
    await this.ensure(organizationId, agreementId);
    return this.prisma.postingAgreementEvaluation.findMany({
      where: { agreementId },
      orderBy: { weekStart: "desc" },
    });
  }

  /** Turns a met-target week into a real Payment — always PENDING, exactly like every other
   * payment in this system, so it still goes through the normal approve -> mark-paid workflow.
   * Never automatic: only callable once an admin has looked at an evaluation and chosen to act
   * on it, and only once per week (paymentId is unique on the evaluation). */
  async createTicket(organizationId: string, evaluationId: string, userId: string) {
    const evaluation = await this.prisma.postingAgreementEvaluation.findFirst({
      where: { id: evaluationId, agreement: { organizationId } },
      include: { agreement: true },
    });
    if (!evaluation) throw new NotFoundException("Evaluation not found");
    if (evaluation.paymentId) throw new BadRequestException("A payment ticket already exists for this week");
    if (!evaluation.targetMet) throw new BadRequestException("This week's target was not met — no ticket to create");

    const agreement = evaluation.agreement;
    const beneficiaryType: PaymentBeneficiaryType = agreement.mediaHostId ? "MEDIA_HOST" : "INFLUENCER";
    const weekLabel = `${evaluation.weekStart.toISOString().slice(0, 10)} to ${evaluation.weekEnd.toISOString().slice(0, 10)}`;
    const performanceNote =
      agreement.targetType === "POST_COUNT"
        ? `${evaluation.actualPostCount} post(s) vs target of ${agreement.postsPerWeek}/week`
        : `${evaluation.actualEngagement ?? 0} ${agreement.engagementMetric} vs target of ${agreement.engagementTarget}/week`;

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          organizationId,
          beneficiaryType,
          mediaHostId: agreement.mediaHostId,
          influencerId: agreement.influencerId,
          paymentDate: new Date(),
          amount: agreement.weeklyAmount,
          currency: agreement.currency,
          description: `Weekly posting agreement (${weekLabel})`,
          notes: performanceNote,
          status: "PENDING",
          createdByUserId: userId,
        },
      });
      await tx.postingAgreementEvaluation.update({ where: { id: evaluation.id }, data: { paymentId: created.id } });
      return created;
    });

    return { ...payment, amount: Number(payment.amount) };
  }
}
