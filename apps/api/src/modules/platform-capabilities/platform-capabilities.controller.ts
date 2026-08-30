import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Public } from "../../common/decorators/public.decorator";

@Controller("api/v1/platform-capabilities")
export class PlatformCapabilitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.platformCapability.findMany({ orderBy: [{ platform: "asc" }, { capability: "asc" }] });
  }
}
