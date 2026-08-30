import { PartialType } from "@nestjs/mapped-types";
import { IsEnum, IsOptional } from "class-validator";
import { MembershipStatus } from "@event-intel/database";
import { CreateMemberDto } from "./create-member.dto";

export class UpdateMemberDto extends PartialType(CreateMemberDto) {
  @IsOptional()
  @IsEnum(MembershipStatus)
  membershipStatus?: MembershipStatus;
}
