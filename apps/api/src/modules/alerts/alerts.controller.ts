import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import type { AlertStatus } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";

@Controller("api/v1/organizations/:organizationId/alerts")
@UseGuards(OrgMembershipGuard)
export class AlertsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Query("status") status?: AlertStatus) {
    return this.prisma.alert.findMany({ where: { organizationId, status }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  @Patch(":alertId/acknowledge")
  acknowledge(@Param("organizationId") organizationId: string, @Param("alertId") alertId: string) {
    return this.prisma.alert.updateMany({ where: { id: alertId, organizationId }, data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() } });
  }

  @Patch(":alertId/resolve")
  resolve(@Param("organizationId") organizationId: string, @Param("alertId") alertId: string, @Body("resolutionNote") _note?: string) {
    return this.prisma.alert.updateMany({ where: { id: alertId, organizationId }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  }
}
