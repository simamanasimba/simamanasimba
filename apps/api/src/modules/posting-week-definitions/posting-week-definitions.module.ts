import { Module } from "@nestjs/common";
import { PostingWeekDefinitionsController } from "./posting-week-definitions.controller";
import { PostingWeekDefinitionsService } from "./posting-week-definitions.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { AuditService } from "../../common/audit.service";

@Module({
  controllers: [PostingWeekDefinitionsController],
  providers: [PostingWeekDefinitionsService, OrgMembershipGuard, AuditService],
  exports: [PostingWeekDefinitionsService],
})
export class PostingWeekDefinitionsModule {}
