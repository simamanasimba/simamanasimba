import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMediaActivationDto } from "./dto/create-media-activation.dto";
import { UpdateMediaActivationDto } from "./dto/update-media-activation.dto";

@Injectable()
export class MediaActivationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureCampaign(organizationId: string, campaignId: string) {
    const campaign = await this.prisma.mediaCampaign.findFirst({ where: { id: campaignId, organizationId } });
    if (!campaign) throw new NotFoundException("Media campaign not found");
    return campaign;
  }

  async list(organizationId: string, campaignId: string) {
    await this.ensureCampaign(organizationId, campaignId);
    return this.prisma.mediaActivation.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } });
  }

  async create(organizationId: string, campaignId: string, dto: CreateMediaActivationDto) {
    await this.ensureCampaign(organizationId, campaignId);
    return this.prisma.mediaActivation.create({ data: { campaignId, ...dto } });
  }

  private async ensure(organizationId: string, campaignId: string, id: string) {
    await this.ensureCampaign(organizationId, campaignId);
    const row = await this.prisma.mediaActivation.findFirst({ where: { id, campaignId } });
    if (!row) throw new NotFoundException("Media activation not found");
    return row;
  }

  async update(organizationId: string, campaignId: string, id: string, dto: UpdateMediaActivationDto) {
    await this.ensure(organizationId, campaignId, id);
    return this.prisma.mediaActivation.update({ where: { id }, data: dto });
  }

  async delete(organizationId: string, campaignId: string, id: string) {
    await this.ensure(organizationId, campaignId, id);
    await this.prisma.mediaActivation.delete({ where: { id } });
    return { success: true };
  }
}
