"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RequireAccess } from "@/components/RequireAccess";
import { FinanceStatCards } from "@/components/FinanceStatCards";
import { TransactionLogTabs } from "@/components/TransactionLogTabs";
import { PerformanceReportView } from "@/components/PerformanceReportView";
import { ConfigureTargetsView } from "@/components/ConfigureTargetsView";
import { PendingApprovalPanel } from "@/components/PendingApprovalPanel";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { canApprovePayment } from "@/lib/permissions";
import { useLang, type DictKey } from "@/lib/i18n";

type ReportView = "finance" | "performance" | "targets";

const TITLES: Record<ReportView, DictKey> = {
  finance: "financeOverviewTitle",
  performance: "overallSystemPerformanceTitle",
  targets: "configureTargetsTitle",
};

const HINTS: Record<ReportView, DictKey> = {
  finance: "paymentReportHelp",
  performance: "overallSystemPerformanceHint",
  targets: "configureTargetsHint",
};

const TABS: Array<{ key: "performance" | "finance"; labelKey: DictKey }> = [
  { key: "performance", labelKey: "overallSystemPerformanceOptionLabel" },
  { key: "finance", labelKey: "financeReportOptionLabel" },
];

export default function FinanceReportsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const searchParams = useSearchParams();
  const { t } = useLang();
  const { data: me } = useAuth();
  const { data: perms } = useRolePermissions(organizationId);
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const canApprove = canApprovePayment(myRole, perms?.matrix);
  const initialView = searchParams.get("view");
  const [view, setView] = useState<ReportView>(initialView === "finance" || initialView === "targets" ? initialView : "performance");

  return (
    <RequireAccess area="finance-reports">
      <div className="-m-4 min-h-[calc(100vh-4rem)] space-y-4 bg-surface p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
        <Link href={`/org/${organizationId}/dashboard`} className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
          <ArrowLeft size={15} /> {t("backToListCta")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{t(TITLES[view])}</h1>
            <p className="mt-1 text-sm text-muted">{t(HINTS[view])}</p>
          </div>
          {view !== "targets" && (
            <div className="no-print flex rounded-xl bg-line/50 p-1">
              {TABS.map((tb) => (
                <button
                  key={tb.key}
                  onClick={() => setView(tb.key)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    view === tb.key ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {t(tb.labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div key={view} className="animate-fade-in space-y-4">
          {view === "finance" && (
            <>
              <FinanceStatCards organizationId={organizationId} />
              {canApprove && <PendingApprovalPanel organizationId={organizationId} />}
              <TransactionLogTabs organizationId={organizationId} />
            </>
          )}
          {view === "performance" && <PerformanceReportView organizationId={organizationId} onConfigureTargets={() => setView("targets")} />}
          {view === "targets" && <ConfigureTargetsView organizationId={organizationId} onBack={() => setView("performance")} />}
        </div>
      </div>
    </RequireAccess>
  );
}
