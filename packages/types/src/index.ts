// Shared cross-app types. Keep this package free of runtime dependencies on
// @prisma/client so it can be imported from the web app without pulling in
// database internals — Prisma's generated enums/types are the source of
// truth on the API/worker side.

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  code: string;
  requestId?: string;
}

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  isPlatformOwner: boolean;
  organizationId?: string;
  role?: string;
}

export interface MemberSummary {
  id: string;
  membershipNumber: string;
  firstName: string;
  lastName: string;
  membershipStatus: string;
  membershipType: string;
}

export interface AttendanceLookupResult {
  found: boolean;
  member?: MemberSummary;
  alreadyCheckedIn?: boolean;
  checkedInAt?: string;
}

export interface LiveAttendanceStats {
  eventId: string;
  registered: number;
  checkedIn: number;
  remaining: number;
  attendanceRate: number;
  walkIns: number;
  updatedAt: string;
}

export type OfflineSyncStatus = "ONLINE" | "OFFLINE" | "SYNCING" | "SYNCED" | "SYNC_ERROR";

export interface OfflineAttendanceQueueItem {
  clientRecordId: string;
  eventId: string;
  membershipNumber: string;
  deviceId: string;
  checkedInAt: string;
}
