"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Radio,
  Star,
  Wallet,
  Crown,
  Settings,
  ShieldCheck,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  X,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { api } from "@/lib/api";
import { readBrandingCache, writeBrandingCache } from "@/lib/brandingCache";
import { BrandMark } from "@/components/BrandMark";
import { LoadingWord } from "@/components/LoadingWord";
import { useLang, type DictKey } from "@/lib/i18n";
import { canAccess, type NavKey } from "@/lib/permissions";
import { ForceChangePasswordScreen } from "@/components/ForceChangePasswordScreen";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type NavChild = { key: string; labelKey: DictKey; icon: LucideIcon };
type NavItem =
  | { type: "link"; key: string; labelKey: DictKey; icon: LucideIcon; href?: string; exact?: boolean }
  | { type: "group"; key: string; labelKey: DictKey; icon: LucideIcon; children: readonly NavChild[] };

const PEOPLE_GROUP: readonly NavChild[] = [
  { key: "members", labelKey: "navMembers", icon: Users },
  { key: "influencers", labelKey: "navInfluencers", icon: Star },
  { key: "media-hosts", labelKey: "navMediaHosts", icon: Radio },
];

const NAV: readonly NavItem[] = [
  { type: "link", key: "dashboard", labelKey: "navDashboard", icon: LayoutDashboard },
  { type: "group", key: "people", labelKey: "navPeopleGroup", icon: Users, children: PEOPLE_GROUP },
  { type: "link", key: "events", labelKey: "navEvents", icon: CalendarDays },
  // The old media-campaigns booking/scoring tool ("Campaign Evaluation Tracker" in a prior
  // round) was deleted entirely per explicit request — "Campaign tracker" actually meant the
  // Overall System Performance report below, not this tool. Its nav entry, pages, and API
  // module are all gone now — see the finance-reports entry below for the real "tracker."
  // Generic "Reports" (event PDF/CSV exports) and "Posts" were both fully deleted (page +
  // exclusive components/API module) per explicit request — no longer just hidden.
  // Influencer 2's campaign logic is now reached directly from the Influencer
  // pages (create/view campaigns from an influencer's own profile) — no more
  // separate "Influencer 2" section, so — like "Posts" above — this nav entry
  // is omitted from the sidebar. The /influencer2 routes themselves still
  // exist and are linked to from the Influencer pages (campaign detail, etc).
  // "finance" links to /finance, which is also a URL-prefix of "finance-reports"'s /finance/reports
  // — exact:true keeps this link from also lighting up while viewing Reports.
  { type: "link", key: "finance", labelKey: "navFinance", icon: Wallet, exact: true },
  // "Campaign tracker" — what the user actually meant by that name: the target-vs-actual
  // performance report (Overall System Performance), reachable at /finance/reports.
  { type: "link", key: "finance-reports", labelKey: "navCampaignTracker", icon: Crown, href: "finance/reports" },
  { type: "link", key: "settings", labelKey: "navSettings", icon: Settings },
  { type: "link", key: "access-control", labelKey: "navAccessControl", icon: ShieldCheck },
];

// Finance Officer's own sidebar — deliberately different from NAV above, and only ever used for
// that one role (everyone else keeps NAV exactly as-is). Their "finance" page IS their dashboard,
// so it's labeled/positioned like one instead of sitting lower down as "Finance"; Influencers and
// Media Hosts are flat top-level links instead of tucked inside the collapsible "People" group,
// since Finance only ever needs those two (never Members) and a click-to-expand group is one extra
// step for something they open constantly.
const NAV_FINANCE: readonly NavItem[] = [
  { type: "link", key: "finance", labelKey: "navDashboard", icon: Wallet, exact: true },
  { type: "link", key: "influencers", labelKey: "navInfluencers", icon: Star },
  { type: "link", key: "media-hosts", labelKey: "navMediaHosts", icon: Radio },
  { type: "link", key: "finance-reports", labelKey: "navCampaignTracker", icon: Crown, href: "finance/reports" },
];

function greetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

export function OrgShell({ organizationId, children }: { organizationId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, isLoading } = useAuth();
  const { data: perms } = useRolePermissions(organizationId);
  const { t } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(() => PEOPLE_GROUP.some((c) => pathname?.startsWith(`/org/${organizationId}/${c.key}`)));
  const { data: org } = useQuery({
    queryKey: ["org", organizationId],
    queryFn: async () => {
      const result = await api.get<{ name: string; logoUrl: string | null; heroImageUrl: string | null }>(`/api/v1/organizations/${organizationId}`);
      writeBrandingCache(result);
      return result;
    },
    enabled: Boolean(data?.user),
    initialData: () => (typeof window !== "undefined" ? readBrandingCache() ?? undefined : undefined),
    initialDataUpdatedAt: 0,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center app-bg">
        <div className="flex items-center gap-3 text-muted">
          <BrandMark className="h-6 w-6 animate-pulse text-brand" />
          <LoadingWord />
        </div>
      </div>
    );
  }
  if (!data?.user) {
    if (typeof window !== "undefined") router.replace("/login");
    return null;
  }
  if (data.user.mustChangePassword) {
    return <ForceChangePasswordScreen />;
  }

  const membership = data.organizations.find((o) => o.organizationId === organizationId);
  const orgName = membership?.organization.name ?? "Organization";
  const initials = `${data.user.firstName[0] ?? ""}${data.user.lastName[0] ?? ""}`.toUpperCase();
  const logoSrc = org?.logoUrl ? (org.logoUrl.startsWith("http") ? org.logoUrl : `${API_BASE}${org.logoUrl}`) : null;

  async function logout() {
    await api.post("/api/v1/auth/logout");
    // Full navigation — same fix as login/register, avoids a stale
    // still-logged-in auth cache surviving the trip to /login.
    window.location.href = "/login";
  }

  // Group items ("people") are never gated directly — they're derived, visible only when at
  // least one child is (checked below), which matters once a child gains access purely through
  // an admin-granted override that doesn't also touch the group itself.
  const activeNav = membership?.role === "FINANCE_OFFICER" ? NAV_FINANCE : NAV;
  const visibleNav = activeNav.filter((item) => item.type === "group" || canAccess(membership?.role, item.key as NavKey, perms?.matrix));

  const navLinks = (onNavigate?: () => void) => (
    <nav className="flex-1 space-y-1 px-3">
      {visibleNav.map((item) => {
        if (item.type === "group") {
          const visibleChildren = item.children.filter((c) => canAccess(membership?.role, c.key as NavKey, perms?.matrix));
          if (visibleChildren.length === 0) return null;
          const groupActive = visibleChildren.some((c) => pathname?.startsWith(`/org/${organizationId}/${c.key}`));
          const GroupIcon = item.icon;
          return (
            <div key={item.key}>
              <button
                onClick={() => setPeopleOpen((v) => !v)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  groupActive ? "text-brand-700" : "text-ink/70 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <GroupIcon size={18} strokeWidth={2.25} className={groupActive ? "text-brand-600" : "text-ink/40 group-hover:text-brand-600"} />
                <span className="flex-1 text-left">{t(item.labelKey)}</span>
                <ChevronDown size={14} className={`text-ink/40 transition-transform ${peopleOpen ? "rotate-180" : ""}`} />
              </button>
              {peopleOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-line pl-3.5">
                  {visibleChildren.map((child) => {
                    const href = `/org/${organizationId}/${child.key}`;
                    const active = pathname?.startsWith(href);
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.key}
                        href={href}
                        onClick={onNavigate}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          active ? "bg-brand-gradient text-white shadow-pop" : "text-ink/70 hover:bg-brand-50 hover:text-brand-700"
                        }`}
                      >
                        <ChildIcon size={16} strokeWidth={2.25} className={active ? "text-white" : "text-ink/40"} />
                        {t(child.labelKey)}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        const href = `/org/${organizationId}/${"href" in item && item.href ? item.href : item.key}`;
        const active = "exact" in item && item.exact ? pathname === href : pathname?.startsWith(href);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={href}
            onClick={onNavigate}
            className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
              active ? "bg-brand-gradient text-white shadow-pop" : "text-ink/70 hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            <Icon size={18} strokeWidth={2.25} className={active ? "text-white" : "text-ink/40 group-hover:text-brand-600"} />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );

  const brandBlock = (
    <div className="flex items-center gap-2.5 px-6 py-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-gradient text-white shadow-pop">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <BrandMark className="h-6 w-6" color="white" initial={orgName[0]} />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-display text-base font-extrabold leading-tight tracking-tight text-ink">Simba SC</p>
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted">{orgName}</p>
      </div>
    </div>
  );

  return (
    <div className="h-dvh overflow-hidden app-bg lg:flex">
      {/* Desktop sidebar — fixed, independent scroll from content */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r border-line/70 bg-white/90 backdrop-blur-sm lg:flex">
        {brandBlock}
        {navLinks()}
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between pr-4">
              {brandBlock}
              <button onClick={() => setMobileNavOpen(false)} className="text-muted hover:text-ink">
                <X size={20} />
              </button>
            </div>
            {navLinks(() => setMobileNavOpen(false))}
          </aside>
        </div>
      )}

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-line/70 bg-white/80 px-4 py-3.5 backdrop-blur-sm sm:px-8 sm:py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNavOpen(true)} className="text-ink/70 hover:text-brand-600 lg:hidden">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <p className="font-display truncate text-base font-bold text-ink sm:text-lg">
                {t(greetingKey())}, {data.user.firstName}
              </p>
              <p className="hidden text-sm text-muted sm:block">
                {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <div className="hidden h-6 w-px bg-line sm:block" />
            <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-ink/60 transition hover:text-brand-600 sm:h-10 sm:w-10">
              <Bell size={17} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" />
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-line bg-white px-1.5 py-1.5 pr-2 transition hover:border-brand-200 sm:px-2 sm:pr-3"
              >
                {data.user.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.user.profilePhotoUrl.startsWith("http") ? data.user.profilePhotoUrl : `${API_BASE}${data.user.profilePhotoUrl}`}
                    alt=""
                    className="h-7 w-7 rounded-lg object-cover sm:h-8 sm:w-8"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-xs font-bold text-white sm:h-8 sm:w-8">
                    {initials}
                  </div>
                )}
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-semibold leading-tight text-ink">{data.user.firstName} {data.user.lastName}</p>
                  <p className="text-[11px] leading-tight text-muted">{membership?.role.replaceAll("_", " ")}</p>
                </div>
                <ChevronDown size={14} className="hidden text-muted sm:block" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-xl border border-line bg-white p-1.5 shadow-card">
                  <Link
                    href={`/org/${organizationId}/profile`}
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:text-brand-700"
                  >
                    <UserCircle size={15} /> {t("myProfile")}
                  </Link>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:text-brand-700"
                  >
                    <LogOut size={15} /> {t("signOut")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
