import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import type { SearchEntityType } from "@event-intel/search";
import { SearchIndexService } from "../search-index/search-index.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";

@Controller("api/v1/organizations/:organizationId/search")
@UseGuards(OrgMembershipGuard)
export class SearchController {
  constructor(private readonly searchIndex: SearchIndexService) {}

  @Get()
  search(
    @Param("organizationId") organizationId: string,
    @Query("q") q: string,
    @Query("entityTypes") entityTypes?: string,
    @Query("page") page?: string,
  ) {
    return this.searchIndex.search({
      organizationId,
      query: q ?? "",
      entityTypes: entityTypes ? (entityTypes.split(",") as SearchEntityType[]) : undefined,
      page: page ? Number(page) : undefined,
    });
  }
}
