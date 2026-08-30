const KEY = "branding-cache-v1";

export interface CachedBranding {
  name: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroSlides?: string[];
}

export function readBrandingCache(): CachedBranding | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CachedBranding) : null;
  } catch {
    return null;
  }
}

export function writeBrandingCache(branding: CachedBranding): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(branding));
  } catch {
    // Storage unavailable (private mode, quota) — the next fetch just replaces it in memory only.
  }
}
