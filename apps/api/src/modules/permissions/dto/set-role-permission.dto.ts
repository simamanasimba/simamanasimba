import { IsBoolean, IsIn } from "class-validator";
import type { RoleKey } from "@event-intel/database";
import { AREAS, ALL_ROLES, type PermissionArea } from "../permissions.constants";

export class SetRolePermissionDto {
  @IsIn(ALL_ROLES)
  role!: RoleKey;

  @IsIn(AREAS)
  area!: PermissionArea;

  @IsBoolean()
  allowed!: boolean;
}
