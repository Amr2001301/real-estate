/**
 * Response headers every page and asset of the public website carries
 * (QA run 1, F-047: the Next apps set none, so the dashboard could be framed
 * and leaked its framework version).
 *
 * The CSP is deliberately limited to the directives that cannot break a page
 * (framing, base URI, form targets, plugins): a script/style allow-list needs
 * per-request nonces and is a separate piece of work.
 */
export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
];
