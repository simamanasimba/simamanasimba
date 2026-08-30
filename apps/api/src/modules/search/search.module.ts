import { Module } from "@nestjs/common";
import { SearchController } from "./search.controller";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";

@Module({
  controllers: [SearchController],
  providers: [OrgMembershipGuard],
})
export class SearchModule {}
