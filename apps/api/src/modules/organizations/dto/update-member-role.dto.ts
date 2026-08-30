import { IsEnum, IsOptional } from "class-validator";
import { RoleKey, OrgMemberStatus } from "@event-intel/database";

export class UpdateMemberRoleDto {
  @IsOptional()
  @IsEnum(RoleKey)
  role?: RoleKey;

  @IsOptional()
  @IsEnum(OrgMemberStatus)
  status?: OrgMemberStatus;
}
