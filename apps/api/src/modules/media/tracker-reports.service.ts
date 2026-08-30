import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTrackerReportDto } from "./dto/create-tracker-report.dto";
import { UpdateTrackerReportDto } from "./dto/update-tracker-report.dto";

@Injectable()
export class TrackerReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureCampaign(organizationId: string, campaignId: string) {
    const campaign = await this.prisma.mediaCampaign.findFirst({ where: { id: campaignId, organizationId } });
    if (!campaign) throw new NotFoundException("Media campaign not found");
    return campaign;
  }

  async list(organizationId: string, campaignId: string) {
    await this.ensureCampaign(organizationId, campaignId);
    return this.prisma.trackerReport.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } });
  }

  async create(organizationId: string, campaignId: string, dto: CreateTrackerReportDto) {
    await this.ensureCampaign(organizationId, campaignId);
    return this.prisma.trackerReport.create({
      data: { campaignId, ...dto, paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined },
    });
  }

  private async ensure(organizationId: string, campaignId: string, id: string) {
    await this.ensureCampaign(organizationId, campaignId);
    const row = await this.prisma.trackerReport.findFirst({ where: { id, campaignId } });
    if (!row) throw new NotFoundException("Tracker report not found");
    return row;
  }

  async update(organizationId: string, campaignId: string, id: string, dto: UpdateTrackerReportDto) {
    await this.ensure(organizationId, campaignId, id);
    return this.prisma.trackerReport.update({
      where: { id },
      data: { ...dto, paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined },
    });
  }

  async delete(organizationId: string, campaignId: string, id: string) {
    await this.ensure(organizationId, campaignId, id);
    await this.prisma.trackerReport.delete({ where: { id } });
    return { success: true };
  }
}
