import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RegionTargetInput } from "./dto/upsert-region-targets.dto";

@Injectable()
export class RegionTargetsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.regionTarget.findMany({ where: { organizationId } });
  }

  async upsertMany(organizationId: string, targets: RegionTargetInput[]) {
    await this.prisma.$transaction(
      targets.map((t) =>
        this.prisma.regionTarget.upsert({
          where: { organizationId_region: { organizationId, region: t.region } },
          create: { organizationId, region: t.region, memberTarget: t.memberTarget ?? null, leaderTarget: t.leaderTarget ?? null },
          update: { memberTarget: t.memberTarget ?? null, leaderTarget: t.leaderTarget ?? null },
        }),
      ),
    );
    return this.list(organizationId);
  }
}
