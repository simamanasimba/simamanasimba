import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardSavedViewsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.dashboardSavedView.findMany({
      where: { organizationId },
      orderBy: { fromDate: "asc" },
    });
  }

  async create(organizationId: string, userId: string, input: { name: string; from: string; to: string }) {
    try {
      return await this.prisma.dashboardSavedView.create({
        data: {
          organizationId,
          name: input.name.trim(),
          fromDate: new Date(input.from),
          toDate: new Date(input.to),
          createdByUserId: userId,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new ConflictException("A saved view with this name already exists");
      }
      throw err;
    }
  }

  async update(organizationId: string, id: string, input: { name?: string; from?: string; to?: string }) {
    const view = await this.prisma.dashboardSavedView.findFirst({ where: { id, organizationId } });
    if (!view) throw new NotFoundException("Saved view not found");
    try {
      return await this.prisma.dashboardSavedView.update({
        where: { id },
        data: {
          ...(input.name != null ? { name: input.name.trim() } : {}),
          ...(input.from != null ? { fromDate: new Date(input.from) } : {}),
          ...(input.to != null ? { toDate: new Date(input.to) } : {}),
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new ConflictException("A saved view with this name already exists");
      }
      throw err;
    }
  }

  async remove(organizationId: string, id: string) {
    const view = await this.prisma.dashboardSavedView.findFirst({ where: { id, organizationId } });
    if (!view) throw new NotFoundException("Saved view not found");
    return this.prisma.dashboardSavedView.delete({ where: { id } });
  }
}
