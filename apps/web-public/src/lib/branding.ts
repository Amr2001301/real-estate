/**
 * Per-tenant branding fetched from GET /v1/public/branding?slug=<slug>.
 * Called from the root layout on every request; cached 300 s in Next.js Data Cache
 * (keyed by full URL, so tenant-a and tenant-b always get separate entries).
 *
 * fetchBranding never throws — returns null on network error, timeout, or
 * unknown slug so the site always renders with neutral fallbacks.
 */

export interface BrandingData {
  slug: string;
  name: string;
  displayName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  ogImageUrl?: string;
  /** Hex string, e.g. "#1E3A5F". */
  primaryColor?: string;
  /** Hex string, e.g. "#C8A24B". */
  accentColor?: string;
  tagline?: { ar: string; en: string };
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsApp?: string;
  contactAddress?: { ar: string; en: string };
  officeHours?: { ar: string; en: string };
  socialLinks?: Record<string, string>;
  registrationNumber?: string;
}

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Convert a 6-digit hex colour to space-separated RGB channel values
 * suitable for CSS custom properties used with Tailwind's opacity modifier
 * syntax: `rgb(var(--c-brand-primary) / <alpha-value>)`.
 *
 * Returns null for any input that is not exactly `#RRGGBB`.
 */
export function hexToRgbVars(hex: string): string | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

export async function fetchBranding(slug: string): Promise<BrandingData | null> {
  if (!slug) return null;
  try {
    const res = await fetch(
      `${API_BASE}/v1/public/branding?slug=${encodeURIComponent(slug)}`,
      {
        // 300 s matches backend Redis TTL. Cache is keyed by full URL, so each
        // tenant slug gets its own entry — no cross-tenant data in a shared cache.
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(3_000),
        headers: { Accept: 'application/json' },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as BrandingData;
  } catch {
    return null;
  }
}
