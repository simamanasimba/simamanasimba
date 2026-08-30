"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { api } from "@/lib/api";
import type { Member } from "@/lib/types";
import { LoadingWord } from "@/components/LoadingWord";
import { RequireAccess } from "@/components/RequireAccess";
import { EditMemberModal } from "@/components/EditMemberModal";
import { useLang } from "@/lib/i18n";

interface MemberProfile {
  member: Member;
  stats: { eventsAttended: number; eventsRegistered: number; lastAttendance: string | null };
  attendanceRecords: Array<{ id: string; checkedInAt: string; method: string; event: { id: string; name: string } }>;
  registrations: Array<{ id: string; registrationStatus: string; event: { id: string; name: string; startDatetime: string; status: string } }>;
}

export default function MemberProfilePage() {
  const { t } = useLang();
  const { organizationId, memberId } = useParams<{ organizationId: string; memberId: string }>();

  const { data, refetch } = useQuery({
    queryKey: ["member", organizationId, memberId],
    queryFn: () => api.get<MemberProfile>(`/api/v1/organizations/${organizationId}/members/${memberId}`),
  });
  const [editing, setEditing] = useState(false);

  if (!data) return <LoadingWord />;
  const { member, stats } = data;

  return (
    <RequireAccess area="members">
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl text-ink">{member.firstName} {member.middleName ?? ""} {member.lastName}</h1>
            <p className="mt-1 font-mono text-sm text-muted">{member.membershipNumber ?? member.campaignId}</p>
          </div>
          <div className="flex items-center gap-2">
            {member.isLeader && <span className="badge bg-brand-50 text-brand-700">{t("leaderBadge")}</span>}
            <span className="badge bg-success/10 text-success">{member.membershipStatus}</span>
            <button className="btn-secondary text-sm" onClick={() => setEditing(true)}><Pencil size={14} /> {t("edit")}</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><p className="text-muted">{t("fieldType")}</p><p className="font-medium text-ink">{member.membershipType}</p></div>
          <div><p className="text-muted">{t("phone")}</p><p className="font-medium text-ink">{member.phone ?? "—"}</p></div>
          <div><p className="text-muted">{t("email")}</p><p className="font-medium text-ink">{member.email ?? "—"}</p></div>
          <div><p className="text-muted">{t("region")}</p><p className="font-medium text-ink">{member.region ?? "—"} {member.district ? `/ ${member.district}` : ""}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card"><p className="text-sm text-muted">{t("eventsAttended")}</p><p className="text-2xl font-bold text-ink">{stats.eventsAttended}</p></div>
        <div className="card"><p className="text-sm text-muted">{t("eventsRegistered")}</p><p className="text-2xl font-bold text-ink">{stats.eventsRegistered}</p></div>
        <div className="card"><p className="text-sm text-muted">{t("lastAttendance")}</p><p className="text-2xl font-bold text-ink">{stats.lastAttendance ? new Date(stats.lastAttendance).toLocaleDateString() : "—"}</p></div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("attendanceHistoryTitle")}</h2>
        {data.attendanceRecords.length === 0 ? (
          <p className="text-sm text-muted">{t("noAttendanceYet")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.attendanceRecords.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink">{r.event.name}</span>
                <span className="text-muted">{new Date(r.checkedInAt).toLocaleString()} · {r.method}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("eventRegistrationsTitle")}</h2>
        {data.registrations.length === 0 ? (
          <p className="text-sm text-muted">{t("noEventRegistrationsYet")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.registrations.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink">{r.event.name}</span>
                <span className="badge bg-surface text-muted">{r.registrationStatus}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <EditMemberModal
          organizationId={organizationId}
          member={member}
          onClose={() => setEditing(false)}
          onDone={() => { setEditing(false); refetch(); }}
        />
      )}
    </div>
    </RequireAccess>
  );
}
