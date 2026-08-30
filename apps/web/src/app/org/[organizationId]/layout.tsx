import { OrgShell } from "@/components/OrgShell";

export default function OrgLayout({ children, params }: { children: React.ReactNode; params: { organizationId: string } }) {
  return <OrgShell organizationId={params.organizationId}>{children}</OrgShell>;
}
