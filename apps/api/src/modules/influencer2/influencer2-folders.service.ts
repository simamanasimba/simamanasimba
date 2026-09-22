import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Influencer2CampaignsService } from "./influencer2-campaigns.service";
import { CreateFolderDto } from "./dto/create-folder.dto";
import { UpdateFolderDto } from "./dto/update-folder.dto";

/** A named, dated grouping of posts — user-facing "campaign" (e.g. "Week 1"). Unlike
 * PostingAgreement's auto-computed weekly cycle, a folder's date range is picked by hand, so gaps
 * and irregular lengths (day 1–5, then day 7–17) are normal. See the schema doc comment on
 * Influencer2Folder and Influencer2CampaignsService.folderAssessment for how posts are grouped
 * into one. */
@Injectable()
export class Influencer2FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: Influencer2CampaignsService,
  ) {}

  private validateBeneficiary(dto: { mediaHostId?: string; influencerId?: string }) {
    if (Boolean(dto.mediaHostId) === Boolean(dto.influencerId)) {
      throw new BadRequestException("A folder belongs to exactly one media host or one influencer");
    }
  }

  async ensure(organizationId: string, id: string) {
    const folder = await this.prisma.influencer2Folder.findFirst({ where: { id, organizationId } });
    if (!folder) throw new NotFoundException("Folder not found");
    return folder;
  }

  /** Every folder for one beneficiary, each with its own assessment (totals) and — when this
   * beneficiary has an active posting agreement — that agreement's evaluation of the folder, if
   * one exists yet. The "which campaign should I file this post under" picker and the Folders
   * panel both read this; the picker just ignores the extra agreement/evaluation fields. */
  async list(organizationId: string, filters: { mediaHostId?: string; influencerId?: string }) {
    const folders = await this.prisma.influencer2Folder.findMany({
      where: { organizationId, mediaHostId: filters.mediaHostId, influencerId: filters.influencerId },
      orderBy: { createdAt: "desc" },
    });
    const assessments = await Promise.all(
      folders.map((f) =>
        this.campaigns.folderAssessment(organizationId, {
          mediaHostId: f.mediaHostId ?? undefined,
          influencerId: f.influencerId ?? undefined,
          folderId: f.id,
          startDate: f.startDate,
          endDate: f.endDate,
        }),
      ),
    );

    const agreement = (filters.mediaHostId || filters.influencerId)
      ? await this.prisma.postingAgreement.findFirst({
          where: { organizationId, mediaHostId: filters.mediaHostId, influencerId: filters.influencerId, isActive: true },
        })
      : null;
    const evaluations = agreement
      ? await this.prisma.postingAgreementEvaluation.findMany({ where: { agreementId: agreement.id, folderId: { in: folders.map((f) => f.id) } } })
      : [];
    const evaluationByFolderId = new Map(evaluations.map((e) => [e.folderId as string, e]));

    return folders.map((f, i) => ({
      ...f,
      assessment: assessments[i],
      agreementId: agreement?.id ?? null,
      evaluation: evaluationByFolderId.get(f.id) ?? null,
    }));
  }

  async create(organizationId: string, dto: CreateFolderDto, userId: string) {
    this.validateBeneficiary(dto);
    return this.prisma.influencer2Folder.create({
      data: {
        organizationId,
        mediaHostId: dto.mediaHostId,
        influencerId: dto.influencerId,
        name: dto.name,
        startDate: dto.startDate ? new Date(`${dto.startDate}T00:00:00.000Z`) : undefined,
        endDate: dto.endDate ? new Date(`${dto.endDate}T23:59:59.999Z`) : undefined,
        createdByUserId: userId,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateFolderDto) {
    await this.ensure(organizationId, id);
    return this.prisma.influencer2Folder.update({
      where: { id },
      data: {
        name: dto.name,
        // Explicit null (not just undefined) when the field is present-but-empty, so clearing a
        // date range by sending "" actually clears it instead of leaving the old value in place.
        startDate: dto.startDate !== undefined ? (dto.startDate ? new Date(`${dto.startDate}T00:00:00.000Z`) : null) : undefined,
        endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(`${dto.endDate}T23:59:59.999Z`) : null) : undefined,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    // A folder is a grouping aid — deleting it must never touch the posts filed under it, so they
    // fall back to unfiled instead of being deleted or orphaned by a dangling folderId.
    await this.prisma.influencer2Campaign.updateMany({ where: { organizationId, folderId: id }, data: { folderId: null } });
    await this.prisma.influencer2Folder.delete({ where: { id } });
    return { success: true };
  }
}
