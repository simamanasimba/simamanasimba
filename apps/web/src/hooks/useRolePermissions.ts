"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PermissionMatrixResponse } from "@/lib/permissions";

/** The org's effective role→area access matrix (fixed defaults + any admin-granted extras from
 * the Access control page). Fetched by any signed-in org member — RequireAccess and OrgShell both
 * need it to know what their own role can reach. */
export function useRolePermissions(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["role-permissions", organizationId],
    queryFn: () => api.get<PermissionMatrixResponse>(`/api/v1/organizations/${organizationId}/role-permissions`),
    enabled: Boolean(organizationId),
  });
}
