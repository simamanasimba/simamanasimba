/**
 * Neutral placeholder mark shown only until an organization uploads its own
 * logo (Settings → Branding). Deliberately plain — a monogram, not artwork.
 */
export function BrandMark({ className = "h-6 w-6", color = "currentColor", initial = "S" }: { className?: string; color?: string; initial?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="56" height="56" rx="16" fill="none" stroke={color} strokeWidth="4" />
      <text x="32" y="42" textAnchor="middle" fontSize="28" fontWeight="800" fontFamily="Manrope, Inter, sans-serif" fill={color}>
        {initial}
      </text>
    </svg>
  );
}
