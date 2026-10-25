/**
 * Native app-store links for the Dar Al Fakhama experience.
 *
 * Intentionally left `null` until the real apps are published. Filling them in
 * automatically enables, with no further code changes:
 *   - device-aware redirects on `/app` (iOS → App Store, Android → Google Play)
 *   - the store buttons on the `/app` landing page
 *
 * While these are `null`, nothing on the site claims a downloadable app exists;
 * `/app` simply routes visitors into the web experience.
 */
export const APP_STORE_URL: string | null = null;
// e.g. 'https://apps.apple.com/sa/app/dar-al-fakhama/id000000000'

export const GOOGLE_PLAY_URL: string | null = null;
// e.g. 'https://play.google.com/store/apps/details?id=ai.macsoft.daralfakhama'

/** True only once both real store links are configured. */
export const STORE_LINKS_READY: boolean = Boolean(APP_STORE_URL && GOOGLE_PLAY_URL);

export type MobileOS = 'ios' | 'android' | 'other';

/** Best-effort mobile-OS sniff from a User-Agent string (used for store redirects). */
export function detectMobileOS(userAgent: string): MobileOS {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'other';
}

/**
 * The store links to show: the company's own app when it is published,
 * otherwise the shared app's (null until those exist).
 */
export function storeLinks(app?: { playStoreUrl?: string; appStoreUrl?: string } | null): {
  appStore: string | null;
  googlePlay: string | null;
} {
  if (app && (app.playStoreUrl || app.appStoreUrl)) {
    return { appStore: app.appStoreUrl ?? null, googlePlay: app.playStoreUrl ?? null };
  }
  return { appStore: APP_STORE_URL, googlePlay: GOOGLE_PLAY_URL };
}

/**
 * The domain's Digital Asset Links statement (/.well-known/assetlinks.json):
 * lets the company's own Android app open this site's links. Empty when the
 * company has no published app or no signing-key fingerprint yet.
 */
export function assetLinks(app?: { packageId: string; androidSha256: string[] } | null) {
  if (!app || app.androidSha256.length === 0) return [];
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: app.packageId,
        sha256_cert_fingerprints: app.androidSha256,
      },
    },
  ];
}
