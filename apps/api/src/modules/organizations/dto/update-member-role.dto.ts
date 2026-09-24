import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { RoleKey, OrgMemberStatus } from "@event-intel/database";

export class UpdateMemberRoleDto {
  @IsOptional()
  @IsEnum(RoleKey)
  role?: RoleKey;

  @IsOptional()
  @IsEnum(OrgMemberStatus)
  status?: OrgMemberStatus;

  /** Only meaningful when role is (or is becoming) GUEST_USER — see OrgMembershipGuard. Either
   * can be sent as an empty string to clear it (unbounded on that side). */
  @IsOptional()
  @IsDateString()
  activeFrom?: string;

  @IsOptional()
  @IsDateString()
  activeUntil?: string;
}
