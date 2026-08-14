const SESSION_KEY = 'utm_attribution';

export interface UtmAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  fbclid?: string;
}

/**
 * Read UTM / Facebook ad attribution from the current URL and persist it to
 * sessionStorage so it survives navigations within the same tab (e.g. visitor
 * lands on /projects?utm_source=facebook, clicks through to /contact, and the
 * source is still captured on the form submission).
 *
 * Overwrites the stored value only when the current URL has attribution params
 * (new click wins over stale session data), so direct navigations inside the
 * session don't erase the original ad-click attribution.
 *
 * Safe to call server-side: returns {} when `window` is not available.
 */
export function captureUtm(): UtmAttribution {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);

  const fromUrl: UtmAttribution = {
    utmSource:   params.get('utm_source')   || undefined,
    utmMedium:   params.get('utm_medium')   || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    utmContent:  params.get('utm_content')  || undefined,
    fbclid:      params.get('fbclid')       || undefined,
  };

  const hasUrlAttribution = Object.values(fromUrl).some(Boolean);

  if (hasUrlAttribution) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(fromUrl));
    } catch {
      // Private browsing / storage full — non-critical.
    }
    return fromUrl;
  }

  // Fall back to what was captured earlier in this session.
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return JSON.parse(stored) as UtmAttribution;
  } catch {
    // Ignore parse errors.
  }

  return {};
}
