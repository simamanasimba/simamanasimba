"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MeResponse } from "@/lib/types";

export function useAuth() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/api/v1/auth/me"),
    retry: false,
  });
}
