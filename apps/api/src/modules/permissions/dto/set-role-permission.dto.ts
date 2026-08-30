import { IsBoolean, IsIn } from "class-validator";
import type { RoleKey } from "@event-intel/database";
import { AREAS, ACTIONS, ALL_ROLES, type PermissionArea, type PermissionAction } from "../permissions.constants";

export class SetRolePermissionDto {
  @IsIn(ALL_ROLES)
  role!: RoleKey;

  @IsIn(AREAS)
  area!: PermissionArea;

  @IsIn(ACTIONS)
  action!: PermissionAction;

  @IsBoolean()
  allowed!: boolean;
}
