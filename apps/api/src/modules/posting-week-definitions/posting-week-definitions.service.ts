import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateWeekDefinitionDto } from "./dto/create-week-definition.dto";
import { UpdateWeekDefinitionDto } from "./dto/update-week-definition.dto";

/** Org-wide, named date windows ("Week 1": Aug 18–28) set up once and read by every media host and
 * influencer's own Campaigns table — see the schema doc comment on PostingWeekDefinition. Replaces
 * each beneficiary getting their own manually-dated Influencer2Folder for the same week; that older
 * per-beneficiary system is untouched and still holds whatever was created before this existed. */
@Injectable()
export class PostingWeekDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(organizationId: string, id: string) {
    const week = await this.prisma.postingWeekDefinition.findFirst({ where: { id, organizationId } });
    if (!week) throw new NotFoundException("Week definition not found");
    return week;
  }

  list(organizationId: string) {
    return this.prisma.postingWeekDefinition.findMany({
      where: { organizationId },
      orderBy: { startDate: "asc" },
    });
  }

  /** Nothing ever stopped two "Week 3"s from existing — a double-submitted form, or two people
   * separately naming a week the same thing, silently produced two rows, each applied to every
   * beneficiary's Campaigns table (so a beneficiary's "Week 3" evaluation/payment shows up twice,
   * and Finance sees it as "still waiting" a second time even after paying the first one). Rejects
   * an exact name match (trimmed, case-insensitive) and an overlapping date range up front instead. */
  async create(organizationId: string, dto: CreateWeekDefinitionDto, userId: string) {
    const startDate = new Date(`${dto.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${dto.endDate}T23:59:59.999Z`);
    await this.assertNoDuplicate(organizationId, dto.name, startDate, endDate);
    return this.prisma.postingWeekDefinition.create({
      data: { organizationId, name: dto.name, startDate, endDate, createdByUserId: userId },
    });
  }

  private async assertNoDuplicate(organizationId: string, name: string, startDate: Date, endDate: Date, excludeId?: string) {
    const existing = await this.prisma.postingWeekDefinition.findMany({ where: { organizationId, id: excludeId ? { not: excludeId } : undefined } });
    const normalizedName = name.trim().toLowerCase();
    const sameName = existing.find((w) => w.name.trim().toLowerCase() === normalizedName);
    if (sameName) throw new BadRequestException(`A week named "${sameName.name}" already exists`);
    // Strict inequalities, not <=/>= : a week's `endDate` already behaves as an EXCLUSIVE boundary
    // everywhere a post's publish date is matched against it (publishedPlatformFilter's `lte: to`,
    // compared against a @db.Date column that reads back as that day's UTC midnight, excludes
    // anything published later that same day) — so one week ending exactly where the next begins
    // is the normal, intended back-to-back case (every week before this check existed was created
    // that way), not a real overlap. The inclusive version rejected exactly that case, which is
    // what made it impossible to add a new week right after an existing one.
    const overlapping = existing.find((w) => startDate < w.endDate && endDate > w.startDate);
    if (overlapping) throw new BadRequestException(`This date range overlaps the existing week "${overlapping.name}" (${overlapping.startDate.toISOString().slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)})`);
  }

  /** Once a week has been evaluated for at least one beneficiary, its dates are locked — changing
   * them would retroactively contradict numbers already computed (and possibly already paid)
   * against the old range. The name alone can still be edited freely. */
  async update(organizationId: string, id: string, dto: UpdateWeekDefinitionDto) {
    const existing = await this.ensure(organizationId, id);
    const changesDates = dto.startDate !== undefined || dto.endDate !== undefined;
    if (changesDates && (await this.hasBeenEvaluated(id))) {
      throw new BadRequestException(
        "This week has already been evaluated for at least one beneficiary — its dates are locked. Only the name can still be changed.",
      );
    }
    const startDate = dto.startDate ? new Date(`${dto.startDate}T00:00:00.000Z`) : existing.startDate;
    const endDate = dto.endDate ? new Date(`${dto.endDate}T23:59:59.999Z`) : existing.endDate;
    if (dto.name !== undefined || changesDates) {
      await this.assertNoDuplicate(organizationId, dto.name ?? existing.name, startDate, endDate, id);
    }
    return this.prisma.postingWeekDefinition.update({
      where: { id },
      data: { name: dto.name, startDate: dto.startDate ? startDate : undefined, endDate: dto.endDate ? endDate : undefined },
    });
  }

  private async hasBeenEvaluated(weekDefinitionId: string): Promise<boolean> {
    const evaluated = await this.prisma.postingAgreementEvaluation.findFirst({ where: { weekDefinitionId }, select: { id: true } });
    return Boolean(evaluated);
  }

  /** Whether real money has already moved against this week for any beneficiary — the only thing
   * that should ever block deleting it. Merely having been *evaluated* (a computed snapshot of
   * posts/engagement vs. target) carries no real-world consequence and shouldn't permanently lock
   * out cleanup — that distinction is exactly what made an accidental duplicate week (see create()'s
   * own doc comment) undeletable once it inevitably got evaluated for whoever it duplicated. */
  private async hasBeenPaid(weekDefinitionId: string): Promise<boolean> {
    const paid = await this.prisma.postingAgreementEvaluation.findFirst({ where: { weekDefinitionId, paymentId: { not: null } }, select: { id: true } });
    return Boolean(paid);
  }

  async remove(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    if (await this.hasBeenPaid(id)) {
      throw new BadRequestException("A payment has already been recorded against this week for at least one beneficiary and it can no longer be deleted.");
    }
    // weekDefinitionId is a plain column, not a real foreign key (same isolation choice as every
    // other cross-module reference in this schema) — deleting the week definition itself would
    // otherwise leave its (unpaid) evaluations behind, pointing at nothing, invisible to every
    // beneficiary's Campaigns table forever. Cleaned up explicitly instead of relying on a cascade
    // that doesn't exist at the DB level.
    await this.prisma.$transaction([
      this.prisma.postingAgreementEvaluation.deleteMany({ where: { weekDefinitionId: id } }),
      this.prisma.postingWeekDefinition.delete({ where: { id } }),
    ]);
    return { success: true };
  }
}
