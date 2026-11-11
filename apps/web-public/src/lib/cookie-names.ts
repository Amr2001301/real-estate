/**
 * The public site's session cookies. They have their own names, apart from the
 * dashboard's (web-admin uses access_token / refresh_token / user): cookies
 * are not separated by port, so on one host — localhost in development, or a
 * shared parent domain — the two apps would otherwise read each other's
 * session (a dashboard sign-in showed up on the site as «Platform», and
 * signing out of the site signed the dashboard out too).
 *
 * Plain constants: imported by the edge proxy, server code and the browser.
 */
export const ACCESS_COOKIE = 'site_access_token';
export const REFRESH_COOKIE = 'site_refresh_token';
export const USER_COOKIE = 'site_user';
