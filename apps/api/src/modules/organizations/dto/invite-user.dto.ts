import { IsDateString, IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { RoleKey } from "@event-intel/database";

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEnum(RoleKey)
  role!: RoleKey;

  /** Only meaningful for role GUEST_USER — see OrgMembershipGuard. */
  @IsOptional()
  @IsDateString()
  activeFrom?: string;

  @IsOptional()
  @IsDateString()
  activeUntil?: string;
}
