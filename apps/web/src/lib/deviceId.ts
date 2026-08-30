export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const KEY = "eip:device-id";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
