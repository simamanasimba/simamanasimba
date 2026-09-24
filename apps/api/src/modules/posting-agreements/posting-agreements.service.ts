import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaymentBeneficiaryType, PostingAgreementEngagementMetric, PostingAgreementEvaluation, Prisma } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { Influencer2CampaignsService } from "../influencer2/influencer2-campaigns.service";
import { Influencer2FoldersService } from "../influencer2/influencer2-folders.service";
import { PostingWeekDefinitionsService } from "../posting-week-definitions/posting-week-definitions.service";
import { CreatePostingAgreementDto } from "./dto/create-posting-agreement.dto";
import { UpdatePostingAgreementDto } from "./dto/update-posting-agreement.dto";
import { MarkAgreementPaidDto } from "./dto/mark-agreement-paid.dto";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export interface WeekWindow {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
}

export type WeekStatus = "IN_PROGRESS" | "PENDING_EVALUATION" | "EVALUATED";

export interface EngagementTargetEntry {
  metric: PostingAgreementEngagementMetric;
  target: number;
}

const VALID_METRICS: PostingAgreementEngagementMetric[] = ["VIEWS", "LIKES", "COMMENTS", "SHARES", "TOTAL_ENGAGEMENT"];

/** Reads an agreement's engagement targets as a typed list, tolerant of both shapes: the current
 * JSON array, and (when that's empty) the older single engagementMetric/engagementTarget pair —
 * see the schema doc comment on PostingAgreement.engagementMetric for why the old columns are
 * still read instead of dropped. */
function normalizeEngagementTargets(agreement: {
  engagementTargets?: Prisma.JsonValue;
  engagementMetric: PostingAgreementEngagementMetric | null;
  engagementTarget: number | null;
}): EngagementTargetEntry[] {
  if (Array.isArray(agreement.engagementTargets)) {
    const parsed = (agreement.engagementTargets as unknown[])
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => ({ metric: e.metric as PostingAgreementEngagementMetric, target: Number(e.target) }))
      .filter((e) => VALID_METRICS.includes(e.metric) && Number.isFinite(e.target) && e.target > 0);
    if (parsed.length > 0) return parsed;
  }
  if (agreement.engagementMetric && agreement.engagementTarget != null) {
    return [{ metric: agreement.engagementMetric, target: agreement.engagementTarget }];
  }
  return [];
}

function toNumericAgreement<T extends { weeklyAmount: Prisma.Decimal; engagementTargets?: Prisma.JsonValue; engagementMetric: PostingAgreementEngagementMetric | null; engagementTarget: number | null }>(agreement: T) {
  return { ...agreement, weeklyAmount: Number(agreement.weeklyAmount), engagementTargets: normalizeEngagementTargets(agreement) };
}

@Injectable()
export class PostingAgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: Influencer2CampaignsService,
    private readonly folders: Influencer2FoldersService,
    private readonly weekDefinitions: PostingWeekDefinitionsService,
  ) {}

  private validateTarget(dto: { mediaHostId?: string; influencerId?: string; postsPerWeek?: number; engagementTargets?: EngagementTargetEntry[] }) {
    if (Boolean(dto.mediaHostId) === Boolean(dto.influencerId)) {
      throw new BadRequestException("An agreement belongs to exactly one media host or one influencer");
    }
    const targets = dto.engagementTargets ?? [];
    if (!dto.postsPerWeek && targets.length === 0) {
      throw new BadRequestException("Set a weekly posts target, at least one engagement target, or both");
    }
    const metrics = targets.map((t) => t.metric);
    if (new Set(metrics).size !== metrics.length) {
      throw new BadRequestException("Each metric can only be targeted once per agreement");
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
    // Lets the frontend lock the target/rate fields once true — see update()'s own enforcement,
    // which this is purely a UI preview of (the real guard is server-side either way).
    const paidFlags = await Promise.all(rows.map((r) => this.hasBeenPaid(r.id)));
    return rows.map((r, i) => ({ ...toNumericAgreement(r), hasBeenPaid: paidFlags[i] }));
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
        engagementTargets: (dto.engagementTargets ?? []) as unknown as Prisma.InputJsonValue,
        weeklyAmount: dto.weeklyAmount,
        currency: dto.currency ?? "TZS",
        notes: dto.notes,
        createdByUserId: userId,
      },
    });
    return toNumericAgreement(row);
  }

  /** Whether this agreement has ever actually paid out — checked against the linked payment's
   * REAL status, not just whether a paymentId was set (a paymentId alone was never proof money
   * moved; see the same note on listWeeks). Once true, the deal's own terms are locked — see
   * update(). */
  private async hasBeenPaid(agreementId: string): Promise<boolean> {
    const paid = await this.prisma.postingAgreementEvaluation.findFirst({
      where: { agreementId, payment: { status: "PAID" } },
      select: { id: true },
    });
    return Boolean(paid);
  }

  async update(organizationId: string, id: string, dto: UpdatePostingAgreementDto) {
    const existing = await this.ensure(organizationId, id);

    const changesTerms =
      dto.postsPerWeek !== undefined ||
      dto.engagementTargets !== undefined ||
      dto.weeklyAmount !== undefined ||
      dto.currency !== undefined;
    if (changesTerms && (await this.hasBeenPaid(id))) {
      throw new BadRequestException(
        "This agreement has already paid out at least one campaign/week — its target and rate can no longer be changed, so a paid figure can never be edited after the fact. Deactivate it and set up a new agreement instead.",
      );
    }

    const merged = {
      mediaHostId: dto.mediaHostId ?? existing.mediaHostId ?? undefined,
      influencerId: dto.influencerId ?? existing.influencerId ?? undefined,
      postsPerWeek: dto.postsPerWeek !== undefined ? dto.postsPerWeek : (existing.postsPerWeek ?? undefined),
      engagementTargets: dto.engagementTargets !== undefined ? dto.engagementTargets : normalizeEngagementTargets(existing),
    };
    this.validateTarget(merged);
    const row = await this.prisma.postingAgreement.update({
      where: { id },
      data: {
        startDate: dto.startDate ? new Date(`${dto.startDate}T00:00:00.000Z`) : undefined,
        // Explicit null (not just undefined) when the dto field is present-but-absent after
        // merging — otherwise Prisma would leave a stale target from before this edit in place
        // (e.g. clearing the post-count target by omitting it from the update).
        postsPerWeek: dto.postsPerWeek !== undefined ? (dto.postsPerWeek ?? null) : undefined,
        engagementTargets: dto.engagementTargets !== undefined ? (dto.engagementTargets as unknown as Prisma.InputJsonValue) : undefined,
        // Once engagementTargets is explicitly saved, the deprecated single-value columns are
        // cleared so normalizeEngagementTargets' legacy fallback never resurrects a stale value
        // this edit was meant to replace or remove.
        engagementMetric: dto.engagementTargets !== undefined ? null : undefined,
        engagementTarget: dto.engagementTargets !== undefined ? null : undefined,
        weeklyAmount: dto.weeklyAmount,
        currency: dto.currency,
        notes: dto.notes,
        isActive: dto.isActive,
      },
    });
    return toNumericAgreement(row);
  }

  /** Deletes the agreement AND every payment ever created from one of its evaluations, including
   * ones already marked PAID — "clear agreement" is a deliberate, confirmed admin action (see the
   * frontend's confirm dialog, which spells this out), not something that happens by accident.
   * Posts themselves are never touched: only the agreement, its evaluations (cascade), and the
   * payments they produced. */
  async remove(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    const evaluations = await this.prisma.postingAgreementEvaluation.findMany({ where: { agreementId: id }, select: { paymentId: true } });
    const paymentIds = evaluations.map((e) => e.paymentId).filter((v): v is string => Boolean(v));

    await this.prisma.$transaction(async (tx) => {
      await tx.postingAgreement.delete({ where: { id } }); // cascades its evaluations
      if (paymentIds.length > 0) {
        await tx.payment.deleteMany({ where: { id: { in: paymentIds }, organizationId } });
      }
    });
    return { success: true, paymentsRemoved: paymentIds.length };
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
    // `payment` included so the frontend can tell "has a paymentId" apart from "is actually PAID"
    // — a payment can exist and still be PENDING/REJECTED (e.g. old data from before markPaidDirectly
    // existed), and paymentId alone was never proof of money having moved.
    const evaluations = await this.prisma.postingAgreementEvaluation.findMany({ where: { agreementId }, include: { payment: { select: { status: true } } } });
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

  /** Every org-wide week definition, each with this ONE beneficiary's assessment (totals) and —
   * when this beneficiary has an active posting agreement — that agreement's evaluation of the
   * week, if one exists yet. Mirrors Influencer2FoldersService.list()'s shape exactly, so the
   * frontend's weekly table can render either the same way. */
  async listWeekDefinitionRows(organizationId: string, filters: { mediaHostId?: string; influencerId?: string }) {
    const weeks = await this.weekDefinitions.list(organizationId);
    const assessments = await Promise.all(
      weeks.map((w) =>
        this.campaigns.weekDefinitionAssessment(organizationId, {
          mediaHostId: filters.mediaHostId,
          influencerId: filters.influencerId,
          startDate: w.startDate,
          endDate: w.endDate,
        }),
      ),
    );

    const agreement = (filters.mediaHostId || filters.influencerId)
      ? await this.prisma.postingAgreement.findFirst({
          where: { organizationId, mediaHostId: filters.mediaHostId, influencerId: filters.influencerId, isActive: true },
        })
      : null;
    // `payment` included so the frontend can tell "has a paymentId" apart from "is actually PAID"
    // — see the same note on listWeeks.
    const evaluations = agreement
      ? await this.prisma.postingAgreementEvaluation.findMany({
          where: { agreementId: agreement.id, weekDefinitionId: { in: weeks.map((w) => w.id) } },
          include: { payment: { select: { status: true } } },
        })
      : [];
    const evaluationByWeekId = new Map(evaluations.map((e) => [e.weekDefinitionId as string, e]));

    return weeks.map((w, i) => ({
      ...w,
      assessment: assessments[i],
      agreementId: agreement?.id ?? null,
      evaluation: evaluationByWeekId.get(w.id) ?? null,
    }));
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

  /** Every configured metric must clear its own target (AND, not OR) — null when there are none
   * configured at all, same "not applicable" meaning postTargetMet/engagementTargetMet already use
   * elsewhere. */
  private engagementTargetsMet(
    summary: { totalViews: number | null; totalLikes: number | null; totalComments: number | null; totalShares: number | null; totalEngagement: number },
    targets: EngagementTargetEntry[],
  ): boolean | null {
    if (targets.length === 0) return null;
    return targets.every((t) => this.pickEngagementValue(summary, t.metric) >= t.target);
  }

  /** What a met-target evaluation is worth: always the flat agreed amount, exactly once the
   * minimum target is met — it does NOT scale up when the actual count exceeds the target (3
   * posts required, 5 delivered still pays the same agreed amount, never 5×). The agreed amount is
   * the deal for meeting the minimum, not a per-unit rate. Finance/an admin can still pay a
   * different amount than the ticket says when actually marking it paid (see Payment.paidAmount +
   * its required variance note) — that's the one place a manual adjustment belongs, never here. */
  private computeAmount(agreement: { weeklyAmount: Prisma.Decimal }): number {
    return agreement.weeklyAmount.toNumber();
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
    const engagementTargetMet = this.engagementTargetsMet(summary, normalizeEngagementTargets(agreement));
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
    const engagementTargetMet = this.engagementTargetsMet(summary, normalizeEngagementTargets(agreement));
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

  /** Evaluates one org-wide week definition against a beneficiary's agreement — the same target
   * check evaluateFolder() does, just measured against weekDefinitionAssessment() instead of a
   * per-beneficiary folder. A week whose endDate is still in the future can't be evaluated yet.
   * Idempotent — re-requesting an already-evaluated week just returns the stored result. */
  async evaluateWeekDefinition(organizationId: string, agreementId: string, weekDefinitionId: string, userId: string): Promise<PostingAgreementEvaluation> {
    const agreement = await this.ensure(organizationId, agreementId);
    const week = await this.weekDefinitions.ensure(organizationId, weekDefinitionId);

    const existing = await this.prisma.postingAgreementEvaluation.findUnique({ where: { agreementId_weekDefinitionId: { agreementId, weekDefinitionId } } });
    if (existing) return existing;

    if (week.endDate.getTime() > Date.now()) {
      throw new BadRequestException("This week isn't finished yet — it can be evaluated once its end date passes");
    }

    const summary = await this.campaigns.weekDefinitionAssessment(organizationId, {
      mediaHostId: agreement.mediaHostId ?? undefined,
      influencerId: agreement.influencerId ?? undefined,
      startDate: week.startDate,
      endDate: week.endDate,
    });

    const postTargetMet = agreement.postsPerWeek != null ? summary.totalPosts >= agreement.postsPerWeek : null;
    const engagementTargetMet = this.engagementTargetsMet(summary, normalizeEngagementTargets(agreement));
    const checks = [postTargetMet, engagementTargetMet].filter((v): v is boolean => v != null);
    const targetMet = checks.length > 0 && checks.every((v) => v === true);

    return this.prisma.postingAgreementEvaluation.create({
      data: {
        agreementId,
        weekDefinitionId,
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

    // Org-wide week definitions apply to every agreement's own beneficiary the same way folders
    // do — evaluated once per (agreement, week), same auto-evaluate-then-list pattern as below.
    const weekDefinitions = await this.weekDefinitions.list(organizationId);

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

      const existingWeekDefEvals = await this.prisma.postingAgreementEvaluation.findMany({
        where: { agreementId: agreement.id, weekDefinitionId: { not: null } },
        select: { weekDefinitionId: true },
      });
      const evaluatedWeekDefIds = new Set(existingWeekDefEvals.map((e) => e.weekDefinitionId));
      for (const week of weekDefinitions) {
        if (evaluatedWeekDefIds.has(week.id)) continue;
        if (week.endDate.getTime() > now) continue; // not finished yet
        await this.evaluateWeekDefinition(organizationId, agreement.id, week.id, userId);
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
    const weekDefIds = [...new Set(evaluations.map((e) => e.weekDefinitionId).filter((v): v is string => Boolean(v)))];
    const [hosts, influencers, folderRows, weekDefRows] = await Promise.all([
      this.prisma.mediaHost.findMany({ where: { id: { in: hostIds } }, select: { id: true, name: true } }),
      this.prisma.influencer.findMany({ where: { id: { in: influencerIds } }, select: { id: true, name: true } }),
      this.prisma.influencer2Folder.findMany({ where: { id: { in: folderIds } }, select: { id: true, name: true } }),
      this.prisma.postingWeekDefinition.findMany({ where: { id: { in: weekDefIds } }, select: { id: true, name: true, startDate: true, endDate: true } }),
    ]);
    const hostName = new Map<string, string>(hosts.map((h) => [h.id, h.name]));
    const influencerName = new Map<string, string>(influencers.map((i) => [i.id, i.name]));
    const folderName = new Map<string, string>(folderRows.map((f) => [f.id, f.name]));
    const weekDefById = new Map(weekDefRows.map((w) => [w.id, w]));

    return evaluations.map((e) => ({
      evaluationId: e.id,
      agreementId: e.agreementId,
      // Whichever of the three linkage modes this evaluation uses — never more than one.
      groupLabel: e.weekNumber != null ? `Week ${e.weekNumber}` : e.weekDefinitionId != null ? (weekDefById.get(e.weekDefinitionId)?.name ?? "—") : (folderName.get(e.folderId!) ?? "—"),
      periodStart: e.weekStart ?? weekDefById.get(e.weekDefinitionId ?? "")?.startDate ?? null,
      periodEnd: e.weekEnd ?? weekDefById.get(e.weekDefinitionId ?? "")?.endDate ?? null,
      beneficiaryType: e.agreement.mediaHostId ? ("MEDIA_HOST" as const) : ("INFLUENCER" as const),
      beneficiaryId: e.agreement.mediaHostId ?? e.agreement.influencerId,
      beneficiaryName: e.agreement.mediaHostId ? (hostName.get(e.agreement.mediaHostId) ?? "—") : (influencerName.get(e.agreement.influencerId!) ?? "—"),
      amount: this.computeAmount(e.agreement),
      currency: e.agreement.currency,
      actualPostCount: e.actualPostCount,
      actualEngagement: e.actualEngagement,
    }));
  }

  /** Shared groundwork for turning a met-target evaluation into money: the checks (exists, no
   * ticket yet, target actually met), the human-readable label for which week/campaign this is,
   * the agreed amount, and a notes string describing how the target was met. Used by both
   * createTicket (the older PENDING-ticket path, kept for any code still calling it) and
   * markPaidDirectly (the one Finance actually uses now — see its own doc comment for why). */
  private async resolvePayableEvaluation(organizationId: string, evaluationId: string) {
    const evaluation = await this.prisma.postingAgreementEvaluation.findFirst({
      where: { id: evaluationId, agreement: { organizationId } },
      include: { agreement: true },
    });
    if (!evaluation) throw new NotFoundException("Evaluation not found");
    if (evaluation.paymentId) throw new BadRequestException("A payment already exists for this week/campaign");
    if (!evaluation.targetMet) throw new BadRequestException("This week's/campaign's requirements were not met — no payment to record");

    const agreement = evaluation.agreement;
    const beneficiaryType: PaymentBeneficiaryType = agreement.mediaHostId ? "MEDIA_HOST" : "INFLUENCER";
    const groupLabel =
      evaluation.weekNumber != null
        ? `week ${evaluation.weekNumber} (${evaluation.weekStart!.toISOString().slice(0, 10)} to ${evaluation.weekEnd!.toISOString().slice(0, 10)})`
        : evaluation.weekDefinitionId != null
          ? ((await this.prisma.postingWeekDefinition.findUnique({ where: { id: evaluation.weekDefinitionId }, select: { name: true } }))?.name ?? "week")
          : ((await this.prisma.influencer2Folder.findUnique({ where: { id: evaluation.folderId! }, select: { name: true } }))?.name ?? "campaign");
    const amount = this.computeAmount(agreement);
    const notesParts: string[] = [];
    if (agreement.postsPerWeek != null) {
      notesParts.push(`${evaluation.actualPostCount} post(s) vs target of ${agreement.postsPerWeek}`);
    }
    const actualSummary = { totalViews: evaluation.actualViews, totalLikes: evaluation.actualLikes, totalComments: evaluation.actualComments, totalShares: evaluation.actualShares, totalEngagement: evaluation.actualEngagement };
    for (const t of normalizeEngagementTargets(agreement)) {
      notesParts.push(`${this.pickEngagementValue(actualSummary, t.metric)} ${t.metric} vs target of ${t.target}`);
    }

    return { evaluation, agreement, beneficiaryType, groupLabel, amount, notes: notesParts.join("; ") };
  }

  /** Turns a met-target week into a real Payment — always PENDING, going through the normal
   * approve -> mark-paid workflow. Superseded by markPaidDirectly for the UI's own "mark as paid"
   * action (that multi-stage pipeline was confusing here — nothing pointed at where a ticket
   * actually went), kept only in case anything else still depends on the PENDING-ticket shape. */
  async createTicket(organizationId: string, evaluationId: string, userId: string) {
    const { evaluation, agreement, beneficiaryType, groupLabel, amount, notes } = await this.resolvePayableEvaluation(organizationId, evaluationId);

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
          notes,
          status: "PENDING",
          createdByUserId: userId,
        },
      });
      await tx.postingAgreementEvaluation.update({ where: { id: evaluation.id }, data: { paymentId: created.id } });
      return created;
    });

    return { ...payment, amount: Number(payment.amount) };
  }

  /** The one real "pay" action: records a met-target week/campaign as PAID immediately — no
   * separate approve step, no PENDING limbo. This *is* Finance actually paying someone, right
   * here, with whatever they attach as proof — not a request that goes somewhere unseen. Only
   * once per week/campaign (paymentId is unique on the evaluation, same guard as createTicket). */
  async markPaidDirectly(organizationId: string, evaluationId: string, dto: MarkAgreementPaidDto, userId: string) {
    const { evaluation, agreement, beneficiaryType, groupLabel, amount, notes } = await this.resolvePayableEvaluation(organizationId, evaluationId);

    const paidAmount = dto.amountPaid ?? amount;
    const amountVarianceNote = paidAmount !== amount ? `Paid ${paidAmount} instead of the agreed ${amount}` : null;

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          organizationId,
          beneficiaryType,
          mediaHostId: agreement.mediaHostId,
          influencerId: agreement.influencerId,
          paymentDate: new Date(`${dto.paymentDate}T00:00:00.000Z`),
          amount,
          currency: agreement.currency,
          description: `Posting agreement — ${groupLabel}`,
          notes,
          method: dto.method,
          referenceNumber: dto.referenceNumber,
          bankName: dto.bankName,
          bankAccountName: dto.bankAccountName,
          bankAccountNumber: dto.bankAccountNumber,
          bankTransactionRef: dto.bankTransactionRef,
          mobileMoneyNumber: dto.mobileMoneyNumber,
          mobileMoneyTransactionId: dto.mobileMoneyTransactionId,
          status: "PAID",
          paidAmount,
          amountVarianceNote,
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
      });
      await tx.postingAgreementEvaluation.update({ where: { id: evaluation.id }, data: { paymentId: created.id } });
      return created;
    });

    return { ...payment, amount: Number(payment.amount), paidAmount: payment.paidAmount != null ? Number(payment.paidAmount) : null };
  }
}
