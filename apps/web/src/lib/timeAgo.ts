/** "Last edited" in a form a human can actually place at a glance — "2 days ago" reads faster
 * than a timestamp when what you're actually asking is "is this stale?". Not routed through the
 * DICT (unlike the rest of this app's text) since it's generated output with unbounded numeric
 * variants, not fixed content — same reasoning as the payment-status badge maps. Callers that want
 * the exact timestamp too should put it in a `title` attribute alongside this. */
export function timeAgo(dateInput: string | Date, lang: "en" | "sw"): string {
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (lang === "sw") {
    if (diffMin < 1) return "Sasa hivi";
    if (diffMin < 60) return `Dakika ${diffMin} zilizopita`;
    if (diffHour < 24) return `Saa ${diffHour} zilizopita`;
    if (diffDay < 1) return "Chini ya siku moja";
    if (diffDay === 1) return "Jana";
    if (diffDay < 7) return `Siku ${diffDay} zilizopita`;
    if (diffWeek < 5) return `Wiki ${diffWeek} zilizopita`;
    if (diffMonth < 12) return `Miezi ${diffMonth} iliyopita`;
    return `Miaka ${diffYear} iliyopita`;
  }

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  if (diffDay < 1) return "Less than a day ago";
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffWeek < 5) return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
}
