"use client";

import { Search } from "lucide-react";

/** The one search-box look used above every filterable table in the app — an icon-prefixed text
 * input, same visual treatment as the Members page's own search box (the original of this
 * pattern). Purely presentational: callers own the search string and how it's applied (a local
 * client-side filter for an already-loaded list, or a query param for a server-paginated one). */
export function TableSearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative flex-1 sm:min-w-[220px] sm:max-w-sm ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        className="input pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
