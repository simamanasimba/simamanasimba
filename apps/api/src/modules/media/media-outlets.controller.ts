import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { MediaHostType } from "@event-intel/database";
import { MediaOutletsService } from "./media-outlets.service";
import { CreateMediaOutletDto } from "./dto/create-media-outlet.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";

@Controller("api/v1/organizations/:organizationId/media-outlets")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("media-hosts")
export class MediaOutletsController {
  constructor(private readonly mediaOutlets: MediaOutletsService) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Query("type") type?: MediaHostType) {
    return this.mediaOutlets.list(organizationId, type);
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  create(@Param("organizationId") organizationId: string, @Body() dto: CreateMediaOutletDto) {
    return this.mediaOutlets.create(organizationId, dto);
  }

  @Get(":outletId/catalog")
  catalog(@Param("organizationId") organizationId: string, @Param("outletId") outletId: string, @Query("type") type?: MediaHostType) {
    return this.mediaOutlets.catalogFor(organizationId, outletId, type);
  }
}
