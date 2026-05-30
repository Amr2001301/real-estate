/**
 * Identity-matching helpers shared by the auth, requests, and reservations
 * modules. The platform has historically had two ways a person can end up
 * with multiple User rows:
 *
 *   1) A guest fills in a public visit-request → `findOrCreateClient`
 *      creates a **synthetic** CLIENT row (no passwordHash).
 *   2) The same person later registers via /auth/customer/register → a
 *      separate registered row is created.
 *
 * Before P8, the registration would refuse with `email_taken` / `phone_taken`
 * whenever the contact info overlapped — but if it diverged even slightly
 * (e.g. registration used email only while the public form captured a phone),
 * two unrelated User rows would coexist forever.
 *
 * This file provides the conservative primitives that the new code uses:
 *
 *   - `digitsOnly(s)`: strip everything except 0-9.
 *   - `normalizePhone(s)`: return the digit-only form when it has at least
 *     `MIN_PHONE_DIGITS` digits (8); otherwise return null. Returning null
 *     forces callers to short-circuit instead of doing an unsafe wide match.
 *   - `normalizeEmail(s)`: trim + lowercase.
 *   - `MIN_PHONE_DIGITS`: the floor used to refuse to match on too-short
 *     phone fragments. Eight is small enough to forgive a dropped country
 *     code while big enough that random digit collisions are rare.
 *
 * All comparisons are intentionally exact-after-normalize — no fuzzy match,
 * no partial-suffix match, no Levenshtein. The trade-off is conscious: a
 * false positive here means surfacing reservations across users.
 */

export const MIN_PHONE_DIGITS = 8;

export function digitsOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D+/g, '');
}

/**
 * Return the canonical digit-only form when the value has at least
 * MIN_PHONE_DIGITS digits. Anything shorter (or empty / null) returns null
 * so the caller skips the match entirely — never collapses to a wildcard.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  const digits = digitsOnly(value);
  if (digits.length < MIN_PHONE_DIGITS) return null;
  return digits;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}
