"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { InfluencerProfile } from "@/lib/types";
import { LoadingWord } from "@/components/LoadingWord";
import { RequireAccess } from "@/components/RequireAccess";
import { PaymentHistoryTable } from "@/components/PaymentHistoryTable";
import { useLang } from "@/lib/i18n";

/** Dedicated payment-history page, reached by clicking "Total Spend" on the profile — reuses the
 * SAME query key as the main profile page so navigating here is a cache hit, not a new fetch. */
export default function InfluencerPaymentsPage() {
  const { organizationId, influencerId } = useParams<{ organizationId: string; influencerId: string }>();
  const { t } = useLang();

  const { data } = useQuery({
    queryKey: ["influencer-profile", influencerId],
    queryFn: () => api.get<InfluencerProfile>(`/api/v1/organizations/${organizationId}/influencers/${influencerId}`),
  });

  if (!data) return <LoadingWord />;
  const { influencer, payments, totalPaid } = data;

  return (
    <RequireAccess area="influencers">
      <div className="space-y-6">
        <Link href={`/org/${organizationId}/influencers/${influencerId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
          <ArrowLeft size={15} /> {t("backToListCta")}
        </Link>

        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{influencer.name}</h1>
          <p className="text-sm text-muted">{t("totalSpend")}: <span className="nums font-semibold text-ink">{totalPaid.toLocaleString()}</span></p>
        </div>

        <PaymentHistoryTable organizationId={organizationId} payments={payments} />
      </div>
    </RequireAccess>
  );
}
