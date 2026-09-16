import { Module } from "@nestjs/common";
import { PostingAgreementsController } from "./posting-agreements.controller";
import { PostingAgreementsService } from "./posting-agreements.service";
import { Influencer2Module } from "../influencer2/influencer2.module";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { AuditService } from "../../common/audit.service";

@Module({
  imports: [Influencer2Module],
  controllers: [PostingAgreementsController],
  providers: [PostingAgreementsService, OrgMembershipGuard, AuditService],
})
export class PostingAgreementsModule {}
