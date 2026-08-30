"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  bare = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  /** Skip the top border/padding — for use as the sole content of a card that already has its own padding. */
  bare?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={bare ? "" : "border-t border-line pt-4"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
        </div>
        <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
