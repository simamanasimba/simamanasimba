import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** A compact, single-line stat — icon + label + number — for dashboard rows that need to fit
 * several stats plus charts on one screen without scrolling. Use StatCard instead when a stat
 * deserves to stand alone as a bigger, clickable tile. */
export function StatTile({
  label,
  value,
  icon: Icon,
  href,
  hint,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  href?: string;
  hint?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="flex h-full items-center gap-2.5 rounded-xl border border-line/60 bg-card px-3 py-2.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted">{label}</p>
        <p className="nums text-base font-bold text-ink">{value}</p>
        {hint && <p className="truncate text-[11px] text-muted">{hint}</p>}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block h-full">{content}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="block h-full w-full text-left">{content}</button>;
  return content;
}
