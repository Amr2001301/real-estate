/**
 * MT-046 — Canonical hostname normalization.
 *
 * Single authoritative function used everywhere: DomainResolverService,
 * CompanyDomainsService, platform subdomain provisioning, backfill script.
 * Apply before every DB read/write involving a hostname.
 *
 * Rules (applied in order):
 *  1. Reject null/empty.
 *  2. Reject if input contains a scheme (://), path (/), or query (?).
 *  3. Strip optional port suffix (:NNNN) — stored hostname is port-free.
 *  4. Trim whitespace.
 *  5. Lowercase.
 *  6. Strip a single trailing dot (DNS FQDN notation).
 *  7. Strip leading "www." prefix so www.example.com → example.com.
 *  8. Validate remaining label structure:
 *       - At least two labels (e.g. acme.platform.com) — single labels rejected.
 *       - Each label: 1–63 chars, [a-z0-9] and hyphens, no leading/trailing hyphen.
 *       - Total length ≤ 253 characters.
 *
 * Throws InvalidHostnameError (a BadRequestException) on any violation.
 * Never throws on platform-internal callers if inputs are already validated.
 */

import { BadRequestException } from '@nestjs/common';

export class InvalidHostnameError extends BadRequestException {
  constructor(reason: string) {
    super({ message: `Invalid hostname: ${reason}`, code: 'INVALID_HOSTNAME' });
  }
}

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeHostname(input: string | null | undefined): string {
  if (!input) throw new InvalidHostnameError('hostname is required');

  // Reject scheme-containing input (http://, https://, etc.)
  if (input.includes('://')) throw new InvalidHostnameError('must not include a scheme (http://, https://)');

  // Reject path components
  const slashIdx = input.indexOf('/');
  if (slashIdx !== -1) throw new InvalidHostnameError('must not include a path component');

  // Reject query strings
  if (input.includes('?')) throw new InvalidHostnameError('must not include a query string');

  // Strip port suffix before further processing
  const colonIdx = input.lastIndexOf(':');
  let raw = colonIdx !== -1 ? input.slice(0, colonIdx) : input;

  raw = raw.trim().toLowerCase();

  // Strip single trailing dot (DNS FQDN)
  if (raw.endsWith('.')) raw = raw.slice(0, -1);

  // Strip leading www. prefix
  if (raw.startsWith('www.')) raw = raw.slice(4);

  if (raw.length === 0) throw new InvalidHostnameError('hostname is empty after normalization');
  if (raw.length > 253) throw new InvalidHostnameError('hostname exceeds 253 characters');

  const labels = raw.split('.');
  if (labels.length < 2) throw new InvalidHostnameError('hostname must have at least two labels (e.g. acme.example.com)');

  for (const label of labels) {
    if (label.length === 0) throw new InvalidHostnameError('hostname contains empty label');
    if (!LABEL_RE.test(label)) {
      throw new InvalidHostnameError(
        `label "${label}" contains invalid characters or has leading/trailing hyphen`,
      );
    }
  }

  return raw;
}
