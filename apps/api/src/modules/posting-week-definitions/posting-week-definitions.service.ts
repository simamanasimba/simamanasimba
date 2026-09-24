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

  create(organizationId: string, dto: CreateWeekDefinitionDto, userId: string) {
    return this.prisma.postingWeekDefinition.create({
      data: {
        organizationId,
        name: dto.name,
        startDate: new Date(`${dto.startDate}T00:00:00.000Z`),
        endDate: new Date(`${dto.endDate}T23:59:59.999Z`),
        createdByUserId: userId,
      },
    });
  }

  /** Once a week has been evaluated for at least one beneficiary, its dates are locked — changing
   * them would retroactively contradict numbers already computed (and possibly already paid)
   * against the old range. The name alone can still be edited freely. */
  async update(organizationId: string, id: string, dto: UpdateWeekDefinitionDto) {
    await this.ensure(organizationId, id);
    const changesDates = dto.startDate !== undefined || dto.endDate !== undefined;
    if (changesDates && (await this.hasBeenEvaluated(id))) {
      throw new BadRequestException(
        "This week has already been evaluated for at least one beneficiary — its dates are locked. Only the name can still be changed.",
      );
    }
    return this.prisma.postingWeekDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(`${dto.startDate}T00:00:00.000Z`) : undefined,
        endDate: dto.endDate ? new Date(`${dto.endDate}T23:59:59.999Z`) : undefined,
      },
    });
  }

  private async hasBeenEvaluated(weekDefinitionId: string): Promise<boolean> {
    const evaluated = await this.prisma.postingAgreementEvaluation.findFirst({ where: { weekDefinitionId }, select: { id: true } });
    return Boolean(evaluated);
  }

  async remove(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    if (await this.hasBeenEvaluated(id)) {
      throw new BadRequestException(
        "This week has already been evaluated (or paid) for at least one beneficiary and can no longer be deleted.",
      );
    }
    await this.prisma.postingWeekDefinition.delete({ where: { id } });
    return { success: true };
  }
}
