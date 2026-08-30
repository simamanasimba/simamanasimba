"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MeResponse } from "@/lib/types";
import { LoadingWord } from "@/components/LoadingWord";

// The public marketing landing page is retired — "/" now always sends visitors
// straight to the login page (or their dashboard if already signed in).
export default function HomePage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/api/v1/auth/me"),
    retry: false,
  });

  useEffect(() => {
    if (isLoading) return;
    if (data?.organizations?.length) {
      router.replace(`/org/${data.organizations[0].organizationId}/dashboard`);
    } else if (data?.user) {
      router.replace("/register");
    } else {
      router.replace("/login");
    }
  }, [data, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center app-bg">
      <LoadingWord />
    </div>
  );
}
