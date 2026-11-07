/**
 * How many reverse proxies stand between the internet and this API
 * (`TRUST_PROXY_HOPS`).
 *
 * The rate limits (sign-in, OTP, the global per-minute cap) are keyed on the
 * request's address. Behind a host's proxy that address is the proxy's, so every
 * user — of every company — shared one bucket (QA F-056): three OTP requests a
 * minute for the whole platform. Telling Express how many hops to trust makes
 * `req.ip` the real client.
 *
 * 0 (the default, and local development) trusts no header: a client cannot
 * choose its own address by sending `X-Forwarded-For`. Set it to the number of
 * proxies the host puts in front of the API — too high lets a client spoof its
 * address and skip the limits, too low keeps the shared bucket.
 */
export function trustProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 5) {
    throw new Error(`TRUST_PROXY_HOPS must be a whole number from 0 to 5, got "${raw}"`);
  }
  return n;
}
