"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { MediaHostProfile } from "@/lib/types";
import { LoadingWord } from "@/components/LoadingWord";
import { RequireAccess } from "@/components/RequireAccess";
import { PaymentHistoryTable } from "@/components/PaymentHistoryTable";
import { useLang } from "@/lib/i18n";

/** Dedicated payment-history page, reached by clicking "Total Spend" on the profile — reuses the
 * SAME query key as the main profile page so navigating here is a cache hit, not a new fetch. */
export default function MediaHostPaymentsPage() {
  const { organizationId, hostId } = useParams<{ organizationId: string; hostId: string }>();
  const { t } = useLang();

  const { data } = useQuery({
    queryKey: ["media-host-profile", hostId],
    queryFn: () => api.get<MediaHostProfile>(`/api/v1/organizations/${organizationId}/media-hosts/${hostId}`),
  });

  if (!data) return <LoadingWord />;
  const { host, payments, totalPaid } = data;

  return (
    <RequireAccess area="media-hosts">
      <div className="space-y-6">
        <Link href={`/org/${organizationId}/media-hosts/${hostId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
          <ArrowLeft size={15} /> {t("backToListCta")}
        </Link>

        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{host.name}</h1>
          <p className="text-sm text-muted">{t("totalSpend")}: <span className="nums font-semibold text-ink">{totalPaid.toLocaleString()}</span></p>
        </div>

        <PaymentHistoryTable organizationId={organizationId} payments={payments} />
      </div>
    </RequireAccess>
  );
}
