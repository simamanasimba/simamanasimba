import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaymentBeneficiaryType, PostingAgreementEngagementMetric, PostingAgreementEvaluation, Prisma } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { Influencer2CampaignsService } from "../influencer2/influencer2-campaigns.service";
import { Influencer2FoldersService } from "../influencer2/influencer2-folders.service";
import { CreatePostingAgreementDto } from "./dto/create-posting-agreement.dto";
import { UpdatePostingAgreementDto } from "./dto/update-posting-agreement.dto";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export interface WeekWindow {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
}

export type WeekStatus = "IN_PROGRESS" | "PENDING_EVALUATION" | "EVALUATED";

function toNumericAgreement<T extends { weeklyAmount: Prisma.Decimal }>(agreement: T) {
  return { ...agreement, weeklyAmount: Number(agreement.weeklyAmount) };
}

@Injectable()
export class PostingAgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: Influencer2CampaignsService,
    private readonly folders: Influencer2FoldersService,
  ) {}

  private validateTarget(dto: { mediaHostId?: string; influencerId?: string; postsPerWeek?: number; engagementMetric?: string; engagementTarget?: number }) {
    if (Boolean(dto.mediaHostId) === Boolean(dto.influencerId)) {
      throw new BadRequestException("An agreement belongs to exactly one media host or one influencer");
    }
    if (!dto.postsPerWeek && !(dto.engagementMetric && dto.engagementTarget)) {
      throw new BadRequestException("Set a weekly posts target, an engagement target, or both");
    }
    if ((dto.engagementMetric && !dto.engagementTarget) || (!dto.engagementMetric && dto.engagementTarget)) {
      throw new BadRequestException("engagementMetric and engagementTarget must be set together");
    }
  }

  private async ensure(organizationId: string, id: string) {
    const agreement = await this.prisma.postingAgreement.findFirst({ where: { id, organizationId } });
    if (!agreement) throw new NotFoundException("Posting agreement not found");
    return agreement;
  }

  /** Every completed (weekEnd in the past) week from the agreement's own startDate up to today —
   * this is how "which weeks exist" is derived, never picked by hand. A week still running today
   * is included too (as IN_PROGRESS) so the card can show what's coming, but it can't be evaluated
   * yet. */
  computeWeeks(startDate: Date, upTo: Date = new Date()): WeekWindow[] {
    const weeks: WeekWindow[] = [];
    let weekStart = new Date(startDate);
    let weekNumber = 1;
    while (weekStart.getTime() <= upTo.getTime()) {
      const weekEnd = new Date(weekStart.getTime() + MS_PER_WEEK - 1);
      weeks.push({ weekNumber, weekStart: new Date(weekStart), weekEnd });
      weekStart = new Date(weekStart.getTime() + MS_PER_WEEK);
      weekNumber += 1;
    }
    return weeks;
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
        startDate: new Date(`${dto.startDate}T00:00:00.000Z`),
        postsPerWeek: dto.postsPerWeek,
        engagementMetric: dto.engagementMetric,
        engagementTarget: dto.engagementTarget,
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
      postsPerWeek: dto.postsPerWeek !== undefined ? dto.postsPerWeek : (existing.postsPerWeek ?? undefined),
      engagementMetric: dto.engagementMetric !== undefined ? dto.engagementMetric : (existing.engagementMetric ?? undefined),
      engagementTarget: dto.engagementTarget !== undefined ? dto.engagementTarget : (existing.engagementTarget ?? undefined),
    };
    this.validateTarget(merged);
    const row = await this.prisma.postingAgreement.update({
      where: { id },
      data: {
        startDate: dto.startDate ? new Date(`${dto.startDate}T00:00:00.000Z`) : undefined,
        // Explicit nulls (not just `undefined`) when a dto field is present-but-absent after
        // merging — otherwise Prisma would leave a stale target from before this edit in place
        // (e.g. clearing the engagement target by omitting it from the update).
        postsPerWeek: dto.postsPerWeek !== undefined ? (dto.postsPerWeek ?? null) : undefined,
        engagementMetric: dto.engagementMetric !== undefined ? (dto.engagementMetric ?? null) : undefined,
        engagementTarget: dto.engagementTarget !== undefined ? (dto.engagementTarget ?? null) : undefined,
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

  /** Attaches a copy of the signed agreement/contract — purely a reference document, never read
   * by any evaluation or payment logic. */
  async setAttachment(organizationId: string, id: string, attachmentUrl: string) {
    await this.ensure(organizationId, id);
    const row = await this.prisma.postingAgreement.update({ where: { id }, data: { attachmentUrl } });
    return toNumericAgreement(row);
  }

  /** Every week from the agreement's startDate to now, each merged with its evaluation if one
   * exists — the single source of truth the frontend reads instead of the admin picking a date. */
  async listWeeks(organizationId: string, agreementId: string) {
    const agreement = await this.ensure(organizationId, agreementId);
    const weeks = this.computeWeeks(agreement.startDate);
    const evaluations = await this.prisma.postingAgreementEvaluation.findMany({ where: { agreementId } });
    const byWeekNumber = new Map(evaluations.map((e) => [e.weekNumber, e]));
    const now = new Date();

    return weeks
      .map((w) => {
        const evaluation = byWeekNumber.get(w.weekNumber) ?? null;
        const status: WeekStatus = evaluation ? "EVALUATED" : w.weekEnd.getTime() <= now.getTime() ? "PENDING_EVALUATION" : "IN_PROGRESS";
        return { weekNumber: w.weekNumber, weekStart: w.weekStart, weekEnd: w.weekEnd, status, evaluation };
      })
      .sort((a, b) => b.weekNumber - a.weekNumber);
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

  /** What a met-target evaluation is actually worth: when the agreement has a post-count target,
   * weeklyAmount is a RATE PAID PER POST, so the total scales with volume — 3 posts required, 5
   * delivered, weeklyAmount=1000 pays 5000, not a flat 1000. Engagement-only agreements (no post
   * target at all) have nothing to multiply by, so weeklyAmount is paid flat once the engagement
   * target is met. */
  private computeAmount(agreement: { postsPerWeek: number | null; weeklyAmount: Prisma.Decimal }, evaluation: { actualPostCount: number }): number {
    return agreement.postsPerWeek != null ? agreement.weeklyAmount.toNumber() * evaluation.actualPostCount : agreement.weeklyAmount.toNumber();
  }

  /** Evaluates one (agreement-relative) week — reuses the same Influencer2Campaign aggregation the
   * Media/Influencer dashboards already read, so there's no separate data source to drift out of
   * sync. Only a completed week (weekEnd already past) can be evaluated, and only once — re-
   * requesting an already-evaluated week just returns the stored result unchanged, so a week that
   * already has a payment ticket can't drift. */
  async evaluateWeek(organizationId: string, agreementId: string, weekNumber: number, userId: string): Promise<PostingAgreementEvaluation> {
    const agreement = await this.ensure(organizationId, agreementId);

    const existing = await this.prisma.postingAgreementEvaluation.findUnique({ where: { agreementId_weekNumber: { agreementId, weekNumber } } });
    if (existing) return existing;

    const weeks = this.computeWeeks(agreement.startDate);
    const week = weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) throw new BadRequestException("That week hasn't started yet for this agreement");
    if (week.weekEnd.getTime() > Date.now()) throw new BadRequestException("This week isn't finished yet — it can be evaluated once it ends");

    const summary = await this.campaigns.weeklyAssessment(organizationId, {
      mediaHostId: agreement.mediaHostId ?? undefined,
      influencerId: agreement.influencerId ?? undefined,
      weekNumber,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
    });

    const postTargetMet = agreement.postsPerWeek != null ? summary.totalPosts >= agreement.postsPerWeek : null;
    const engagementTargetMet =
      agreement.engagementMetric && agreement.engagementTarget != null
        ? this.pickEngagementValue(summary, agreement.engagementMetric) >= agreement.engagementTarget
        : null;
    const checks = [postTargetMet, engagementTargetMet].filter((v): v is boolean => v != null);
    const targetMet = checks.length > 0 && checks.every((v) => v === true);

    return this.prisma.postingAgreementEvaluation.create({
      data: {
        agreementId,
        weekNumber,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        actualPostCount: summary.totalPosts,
        actualViews: summary.totalViews,
        actualLikes: summary.totalLikes,
        actualComments: summary.totalComments,
        actualShares: summary.totalShares,
        actualEngagement: summary.totalEngagement,
        postTargetMet,
        engagementTargetMet,
        targetMet,
        evaluatedByUserId: userId,
      },
    });
  }

  /** Evaluates one folder ("campaign") against its beneficiary's agreement — the same target check
   * evaluateWeek() does, just measured against folderAssessment() instead of a computed week
   * window. A folder with an endDate still in the future can't be evaluated yet (mirrors
   * evaluateWeek's "this week isn't finished yet" guard); one with no endDate at all is always
   * open-ended and evaluable on demand, since nothing declared when it's "done". Idempotent, same
   * as evaluateWeek — re-requesting an already-evaluated folder just returns the stored result. */
  async evaluateFolder(organizationId: string, agreementId: string, folderId: string, userId: string): Promise<PostingAgreementEvaluation> {
    const agreement = await this.ensure(organizationId, agreementId);
    const folder = await this.folders.ensure(organizationId, folderId);

    const existing = await this.prisma.postingAgreementEvaluation.findUnique({ where: { agreementId_folderId: { agreementId, folderId } } });
    if (existing) return existing;

    if (folder.endDate && folder.endDate.getTime() > Date.now()) {
      throw new BadRequestException("This campaign isn't finished yet — it can be evaluated once its end date passes");
    }

    const summary = await this.campaigns.folderAssessment(organizationId, {
      mediaHostId: agreement.mediaHostId ?? undefined,
      influencerId: agreement.influencerId ?? undefined,
      folderId,
      startDate: folder.startDate,
      endDate: folder.endDate,
    });

    const postTargetMet = agreement.postsPerWeek != null ? summary.totalPosts >= agreement.postsPerWeek : null;
    const engagementTargetMet =
      agreement.engagementMetric && agreement.engagementTarget != null
        ? this.pickEngagementValue(summary, agreement.engagementMetric) >= agreement.engagementTarget
        : null;
    const checks = [postTargetMet, engagementTargetMet].filter((v): v is boolean => v != null);
    const targetMet = checks.length > 0 && checks.every((v) => v === true);

    return this.prisma.postingAgreementEvaluation.create({
      data: {
        agreementId,
        folderId,
        actualPostCount: summary.totalPosts,
        actualViews: summary.totalViews,
        actualLikes: summary.totalLikes,
        actualComments: summary.totalComments,
        actualShares: summary.totalShares,
        actualEngagement: summary.totalEngagement,
        postTargetMet,
        engagementTargetMet,
        targetMet,
        evaluatedByUserId: userId,
      },
    });
  }

  /** Finance's own queue: every completed week, across every agreement in the org, that met its
   * target(s) but hasn't been turned into a payment ticket yet — the whole point of "we pay by
   * agreement, not by post" only works if Finance can see this without hunting through each host's
   * or influencer's own page. Auto-evaluates any completed-but-unevaluated week first — safe,
   * since evaluateWeek() is idempotent and only computes/stores a snapshot from real data; it never
   * moves money. Only createTicket() does that, and it stays a separate, explicit action Finance
   * (or an admin) still has to click. */
  async listReadyForPayment(organizationId: string, userId: string) {
    const agreements = await this.prisma.postingAgreement.findMany({ where: { organizationId, isActive: true } });
    const now = Date.now();

    for (const agreement of agreements) {
      const weeks = this.computeWeeks(agreement.startDate);
      const existingWeekEvals = await this.prisma.postingAgreementEvaluation.findMany({ where: { agreementId: agreement.id }, select: { weekNumber: true } });
      const evaluatedWeekNumbers = new Set(existingWeekEvals.map((e) => e.weekNumber));
      for (const w of weeks) {
        if (w.weekEnd.getTime() <= now && !evaluatedWeekNumbers.has(w.weekNumber)) {
          await this.evaluateWeek(organizationId, agreement.id, w.weekNumber, userId);
        }
      }

      // Folders ("campaigns") belong to a beneficiary, not to one agreement directly — the same
      // rule PostingAgreement itself uses (one agreement's target applies to every folder/campaign
      // its beneficiary creates, see Influencer2FoldersService).
      const beneficiaryFolders = await this.prisma.influencer2Folder.findMany({
        where: agreement.mediaHostId ? { organizationId, mediaHostId: agreement.mediaHostId } : { organizationId, influencerId: agreement.influencerId },
      });
      const existingFolderEvals = await this.prisma.postingAgreementEvaluation.findMany({
        where: { agreementId: agreement.id, folderId: { not: null } },
        select: { folderId: true },
      });
      const evaluatedFolderIds = new Set(existingFolderEvals.map((e) => e.folderId));
      for (const folder of beneficiaryFolders) {
        if (evaluatedFolderIds.has(folder.id)) continue;
        if (folder.endDate && folder.endDate.getTime() > now) continue; // not finished yet
        await this.evaluateFolder(organizationId, agreement.id, folder.id, userId);
      }
    }

    const evaluations = await this.prisma.postingAgreementEvaluation.findMany({
      where: { targetMet: true, paymentId: null, agreement: { organizationId } },
      include: { agreement: true },
      orderBy: { createdAt: "desc" },
    });

    const hostIds = [...new Set(evaluations.map((e) => e.agreement.mediaHostId).filter((v): v is string => Boolean(v)))];
    const influencerIds = [...new Set(evaluations.map((e) => e.agreement.influencerId).filter((v): v is string => Boolean(v)))];
    const folderIds = [...new Set(evaluations.map((e) => e.folderId).filter((v): v is string => Boolean(v)))];
    const [hosts, influencers, folderRows] = await Promise.all([
      this.prisma.mediaHost.findMany({ where: { id: { in: hostIds } }, select: { id: true, name: true } }),
      this.prisma.influencer.findMany({ where: { id: { in: influencerIds } }, select: { id: true, name: true } }),
      this.prisma.influencer2Folder.findMany({ where: { id: { in: folderIds } }, select: { id: true, name: true } }),
    ]);
    const hostName = new Map<string, string>(hosts.map((h) => [h.id, h.name]));
    const influencerName = new Map<string, string>(influencers.map((i) => [i.id, i.name]));
    const folderName = new Map<string, string>(folderRows.map((f) => [f.id, f.name]));

    return evaluations.map((e) => ({
      evaluationId: e.id,
      agreementId: e.agreementId,
      // Either the auto-computed week's own label, or the folder's own name — never both.
      groupLabel: e.weekNumber != null ? `Week ${e.weekNumber}` : (folderName.get(e.folderId!) ?? "—"),
      periodStart: e.weekStart,
      periodEnd: e.weekEnd,
      beneficiaryType: e.agreement.mediaHostId ? ("MEDIA_HOST" as const) : ("INFLUENCER" as const),
      beneficiaryId: e.agreement.mediaHostId ?? e.agreement.influencerId,
      beneficiaryName: e.agreement.mediaHostId ? (hostName.get(e.agreement.mediaHostId) ?? "—") : (influencerName.get(e.agreement.influencerId!) ?? "—"),
      ratePerPost: e.agreement.postsPerWeek != null ? Number(e.agreement.weeklyAmount) : null,
      amount: this.computeAmount(e.agreement, e),
      currency: e.agreement.currency,
      actualPostCount: e.actualPostCount,
      actualEngagement: e.actualEngagement,
    }));
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
    if (!evaluation.targetMet) throw new BadRequestException("This week's requirements were not met — no ticket to create");

    const agreement = evaluation.agreement;
    const beneficiaryType: PaymentBeneficiaryType = agreement.mediaHostId ? "MEDIA_HOST" : "INFLUENCER";
    const groupLabel =
      evaluation.weekNumber != null
        ? `week ${evaluation.weekNumber} (${evaluation.weekStart!.toISOString().slice(0, 10)} to ${evaluation.weekEnd!.toISOString().slice(0, 10)})`
        : ((await this.prisma.influencer2Folder.findUnique({ where: { id: evaluation.folderId! }, select: { name: true } }))?.name ?? "campaign");
    const amount = this.computeAmount(agreement, evaluation);
    const notesParts: string[] = [];
    if (agreement.postsPerWeek != null) {
      notesParts.push(`${evaluation.actualPostCount} post(s) vs target of ${agreement.postsPerWeek} — ${agreement.currency} ${agreement.weeklyAmount.toNumber()}/post = ${agreement.currency} ${amount}`);
    }
    if (agreement.engagementMetric && agreement.engagementTarget != null) {
      const actual = this.pickEngagementValue(
        { totalViews: evaluation.actualViews, totalLikes: evaluation.actualLikes, totalComments: evaluation.actualComments, totalShares: evaluation.actualShares, totalEngagement: evaluation.actualEngagement },
        agreement.engagementMetric,
      );
      notesParts.push(`${actual} ${agreement.engagementMetric} vs target of ${agreement.engagementTarget}`);
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          organizationId,
          beneficiaryType,
          mediaHostId: agreement.mediaHostId,
          influencerId: agreement.influencerId,
          paymentDate: new Date(),
          amount,
          currency: agreement.currency,
          description: `Posting agreement — ${groupLabel}`,
          notes: notesParts.join("; "),
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
