export interface QueuedCheckIn {
  clientRecordId: string;
  memberId: string;
  checkedInAt: string;
}

function key(eventId: string): string {
  return `eip:offline-queue:${eventId}`;
}

export function loadQueue(eventId: string): QueuedCheckIn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(eventId));
    return raw ? (JSON.parse(raw) as QueuedCheckIn[]) : [];
  } catch {
    return [];
  }
}

export function saveQueue(eventId: string, items: QueuedCheckIn[]): void {
  try {
    window.localStorage.setItem(key(eventId), JSON.stringify(items));
  } catch {
    // localStorage unavailable (private browsing, quota) — the in-memory queue
    // for this session still works, it just won't survive a reload.
  }
}

export function enqueue(eventId: string, item: QueuedCheckIn): void {
  const items = loadQueue(eventId);
  items.push(item);
  saveQueue(eventId, items);
}

export function clearSynced(eventId: string, syncedClientRecordIds: string[]): void {
  const remaining = loadQueue(eventId).filter((i) => !syncedClientRecordIds.includes(i.clientRecordId));
  saveQueue(eventId, remaining);
}
