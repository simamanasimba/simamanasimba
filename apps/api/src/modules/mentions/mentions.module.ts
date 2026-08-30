import { Module } from "@nestjs/common";
import { MentionsController } from "./mentions.controller";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";

@Module({
  controllers: [MentionsController],
  providers: [OrgMembershipGuard],
})
export class MentionsModule {}
