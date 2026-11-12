/**
 * Per-tenant branding fetched from GET /v1/public/branding?slug=<slug>.
 * Called from the root layout on every request; cached 60 s in Next.js Data Cache
 * (keyed by full URL, so tenant-a and tenant-b always get separate entries).
 *
 * fetchBranding never throws — returns null on network error, timeout, or
 * unknown slug so the site always renders with neutral fallbacks.
 */

export interface BrandingData {
  slug: string;
  name: string;
  displayName?: string;
  /** The public name for the English site (falls back to `displayName` / `name`). */
  displayNameEn?: string;
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
  /** ISO 4217 — every price on the site is shown in it (Company.currency). */
  currency?: string;
  /** The company's own app, once published in the stores (MA4). */
  mobileApp?: {
    /** Flattened to the request's language by the API. */
    name: string;
    packageId: string;
    playStoreUrl?: string;
    appStoreUrl?: string;
    androidSha256: string[];
  };
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

type Rgb = [number, number, number];

function parseHex(hex: string | undefined): Rgb | null {
  const m = hex ? /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim()) : null;
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : null;
}
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as Rgb;
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const lum = ([r, g, b]: Rgb) => {
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: Rgb, b: Rgb) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
const vars = ([r, g, b]: Rgb) => `${r} ${g} ${b}`;

/**
 * The company's colours as the site's two scales (navy = the dark surfaces:
 * header, hero, footer, buttons; gold = the accent: highlights, badges, rings),
 * as CSS custom properties for `:root`. The surfaces are dark by design, so a
 * light primary is darkened until white text reads on it; an accent that would
 * vanish on the primary is lightened. Without a valid colour the site keeps its
 * defaults (globals.css), so a company that set nothing looks as before.
 */
export function brandThemeVars(primaryHex: string | undefined, accentHex: string | undefined): string | null {
  let primary = parseHex(primaryHex);
  let accent = parseHex(accentHex);
  const out: string[] = [];
  if (primary) {
    for (let i = 0; i < 12 && lum(primary) > 0.18; i++) primary = mix(primary, BLACK, 0.12);
    out.push(
      `--c-brand-primary:${vars(primary)}`,
      `--c-navy:${vars(primary)}`,
      `--c-navy-700:${vars(mix(primary, WHITE, 0.07))}`,
      `--c-navy-600:${vars(mix(primary, WHITE, 0.14))}`,
    );
  }
  if (accent) {
    const base = primary ?? ([14, 22, 38] as Rgb);
    for (let i = 0; i < 12 && contrast(accent, base) < 3; i++) accent = mix(accent, WHITE, 0.12);
    out.push(
      `--c-brand-accent:${vars(accent)}`,
      `--c-gold-50:${vars(mix(accent, WHITE, 0.9))}`,
      `--c-gold-100:${vars(mix(accent, WHITE, 0.8))}`,
      `--c-gold-200:${vars(mix(accent, WHITE, 0.55))}`,
      `--c-gold-300:${vars(mix(accent, WHITE, 0.22))}`,
      `--c-gold-400:${vars(accent)}`,
      `--c-gold-500:${vars(mix(accent, BLACK, 0.1))}`,
      `--c-gold-600:${vars(mix(accent, BLACK, 0.22))}`,
      `--c-gold-700:${vars(mix(accent, BLACK, 0.38))}`,
    );
  }
  return out.length ? out.join(';') : null;
}

export async function fetchBranding(slug: string): Promise<BrandingData | null> {
  if (!slug) return null;
  try {
    const res = await fetch(
      `${API_BASE}/v1/public/branding?slug=${encodeURIComponent(slug)}`,
      {
        // 60 s: the API invalidates its own cache when the admin saves the
        // branding, so a change (logo, colours, currency) shows on the site
        // within a minute. Cache is keyed by full URL, so each tenant slug gets
        // its own entry — no cross-tenant data in a shared cache.
        next: { revalidate: 60 },
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

/** The company's public name in the visitor's language (F-067). */
export function companyName(branding: BrandingData | null | undefined, locale: 'ar' | 'en', fallback: string): string {
  if (locale === 'en' && branding?.displayNameEn?.trim()) return branding.displayNameEn.trim();
  return branding?.displayName ?? branding?.name ?? fallback;
}

/**
 * A translatable branding text (tagline, address, office hours) in the
 * visitor's language: the API may send it as { ar, en } or already
 * flattened to one string by its locale interceptor.
 */
export function brandingText(v: unknown, locale: 'ar' | 'en'): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (v && typeof v === 'object') return ((v as Record<string, string | undefined>)[locale] ?? '').trim() || undefined;
  return undefined;
}
