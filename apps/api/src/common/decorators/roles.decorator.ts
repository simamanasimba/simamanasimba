import { SetMetadata } from "@nestjs/common";
import { RoleKey } from "@event-intel/database";

export const ROLES_KEY = "roles";

/** Restricts a route to organization members holding one of the given roles (platform owners always pass). */
export const Roles = (...roles: RoleKey[]) => SetMetadata(ROLES_KEY, roles);
