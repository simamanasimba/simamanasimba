import Link from "next/link";
import type { LucideIcon } from "lucide-react";

const TONES = {
  red: "bg-brand-50 text-brand-700",
  green: "bg-green-50 text-success",
  amber: "bg-amber-50 text-warning",
  blue: "bg-blue-50 text-info",
  violet: "bg-violet-50 text-violet",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "red",
  href,
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
  trend?: { value: string; positive?: boolean };
}) {
  const content = (
    <div className="card flex h-full items-start justify-between transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex h-full flex-col">
        {Icon && (
          <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full ${TONES[tone]}`}>
            <Icon size={27} strokeWidth={2} />
          </div>
        )}
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="nums mt-1 font-display text-2xl font-extrabold text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {trend && (
        <span className={`badge ${trend.positive === false ? "bg-brand-50 text-brand-700" : "bg-green-50 text-success"}`}>
          {trend.value}
        </span>
      )}
    </div>
  );

  return href ? <Link href={href} className="block h-full">{content}</Link> : content;
}
