import { IsEmail, IsEnum, IsString } from "class-validator";
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
}
