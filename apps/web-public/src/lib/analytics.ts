/**
 * Centralized analytics abstraction. All event firing goes through trackEvent —
 * no scattered gtag() calls in components.
 *
 * Privacy rules (hard-enforced, not just convention):
 *   - Missing measurement ID in dev → analytics silently disabled, zero errors.
 *   - Sensitive routes (/reset-password, /verify-email) → pathname only, query stripped.
 *   - Any param key matching the PII list → event blocked entirely.
 */

// Read at call time so the value is testable (process.env can be set before calling).
// Next.js inlines NEXT_PUBLIC_ vars during the webpack build regardless.
function getMeasurementId(): string | undefined {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
}

const SENSITIVE_PREFIXES = ['/reset-password', '/verify-email'];

const PII_KEYS = new Set([
  'email',
  'phone',
  'name',
  'full_name',
  'fullname',
  'password',
  'otp',
  'token',
  'reset_token',
  'verification_token',
  'jwt',
  'access_token',
  'refresh_token',
]);

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function isEnabled(): boolean {
  return Boolean(getMeasurementId()) && typeof window !== 'undefined' && Boolean(window.gtag);
}

/** Strip query + hash from sensitive auth routes before sending to GA. */
export function safePath(rawPathname: string): string {
  for (const prefix of SENSITIVE_PREFIXES) {
    if (rawPathname.startsWith(prefix)) return prefix;
  }
  return rawPathname;
}

/** Returns true if any param key matches the PII blocklist (case-insensitive). */
export function hasPii(params: Record<string, unknown>): boolean {
  return Object.keys(params).some((k) => PII_KEYS.has(k.toLowerCase()));
}

/** Fire a GA4 page_view for the given pathname (sensitive paths are stripped). */
export function trackPageView(pathname: string): void {
  if (!isEnabled()) return;
  window.gtag!('config', getMeasurementId()!, { page_path: safePath(pathname) });
}

/**
 * Fire a GA4 custom event. Blocked silently when:
 *   - GA4 is disabled (no measurement ID or script not loaded)
 *   - params contain any PII key
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (!isEnabled()) return;
  if (hasPii(params)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[analytics] Blocked event — PII keys detected:', Object.keys(params));
    }
    return;
  }
  window.gtag!('event', name, params);
}
