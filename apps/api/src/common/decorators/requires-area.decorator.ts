import { SetMetadata } from "@nestjs/common";
import type { PermissionArea } from "../../modules/permissions/permissions.constants";

export const AREA_KEY = "requiresArea";

/** Layered on top of @Roles(...) on the same route: a role outside the static @Roles list can
 * still pass if an org admin has additively granted that role this area via the Access control
 * page's permission matrix (see PermissionsService). Never narrows access — only widens it. */
export const RequiresArea = (area: PermissionArea) => SetMetadata(AREA_KEY, area);
