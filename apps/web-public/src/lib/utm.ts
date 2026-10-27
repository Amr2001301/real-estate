const STORAGE_KEY = 'utm_attribution';
/** How long an ad click is remembered: a visitor may come back days later to fill a form. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface UtmAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  fbclid?: string;
}

/**
 * Read UTM / Facebook ad attribution from the current URL and keep it in
 * localStorage for 30 days, so it survives the visitor moving around the
 * site (lands on /projects/x?utm_campaign=…, goes to /contact) and coming
 * back to fill a form later. Called on every page (UtmCapture) — not only
 * where a form is — or a visitor who landed on a project page was lost.
 *
 * Overwrites the stored value only when the current URL has attribution params
 * (a new click wins over older data), so later direct visits don't erase it.
 *
 * Safe to call server-side: returns {} when `window` is not available.
 */
export function captureUtm(now: number = Date.now()): UtmAttribution {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);

  const fromUrl: UtmAttribution = {
    utmSource:   params.get('utm_source')   || undefined,
    utmMedium:   params.get('utm_medium')   || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    utmContent:  params.get('utm_content')  || undefined,
    fbclid:      params.get('fbclid')       || undefined,
  };

  if (Object.values(fromUrl).some(Boolean)) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: now, data: fromUrl }));
    } catch {
      // Private browsing / storage full — non-critical.
    }
    return fromUrl;
  }

  // Fall back to the last ad click, while it is recent enough.
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { at, data } = JSON.parse(stored) as { at: number; data: UtmAttribution };
      if (typeof at === 'number' && now - at <= TTL_MS && data) return data;
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore parse errors.
  }

  return {};
}
