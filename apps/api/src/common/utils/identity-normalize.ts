/**
 * MT-018 / MT-019 — Canonical identity normalizers.
 *
 * These are the authoritative normalization functions for email addresses and
 * phone numbers. Use these on all new write paths; the legacy helpers in
 * identity-match.ts (normalizeEmail / normalizePhone) remain in use for the
 * synthetic-peer claim logic and must not be changed as part of this ticket.
 *
 * Functions exported:
 *   canonicalEmail(value)              — MT-018: trim + lowercase; null on empty
 *   canonicalPhone(value, countryHint) — MT-019: E.164 via libphonenumber-js;
 *                                        null when unparseable or ambiguous
 *
 * IMPORTANT: These functions do NOT mutate existing stored values. All stored
 * phone values remain in their current form until a separate backfill migration
 * is run (MT-020, deferred). Only future writes should use canonicalPhone().
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

// ---------------------------------------------------------------------------
// MT-018 — Canonical email normalization
// ---------------------------------------------------------------------------

/**
 * Return the canonical form of an email address: trimmed and lowercased.
 * Returns null for empty, null, or undefined input so callers can short-circuit.
 *
 * Intentionally simple — no Gmail dot normalization, no internationalized domain
 * processing — to keep the collision surface predictable. Future normalization
 * rules must be introduced as explicit migrations, not silently added here.
 */
export function canonicalEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

// ---------------------------------------------------------------------------
// MT-019 — Canonical E.164 phone normalization (multi-country, no guessing)
// ---------------------------------------------------------------------------

/**
 * Return the E.164 canonical form of a phone number, or null when the input
 * cannot be unambiguously resolved.
 *
 * Parsing rules:
 *   1. E.164 / explicit + prefix: parsed directly without a country hint.
 *      `+CC…` is self-identifying. Returns null if malformed.
 *   2. Any other format (including 00 IDD prefix, local/national) with an
 *      explicit countryHint: parsed using that country's dialling rules.
 *      `00966…` with countryHint='SA' resolves correctly because SA uses
 *      `00` as its IDD prefix.
 *   3. Any non-+ format WITHOUT a countryHint: returns null.
 *      Local, national, and IDD-prefixed numbers are ambiguous without
 *      country context. This function never guesses.
 *
 * libphonenumber-js only recognises `+` as an internationally unambiguous
 * prefix when called without a default country. The `00` IDD prefix requires
 * knowing the originating country's dialling rules to decode safely.
 *
 * @param value        Raw phone string from user input or database.
 * @param countryHint  ISO 3166-1 alpha-2 country code (e.g. Company.country).
 *                     Required for any non-E.164 format.
 *
 * @example
 *   canonicalPhone('+966500000000')              // '+966500000000'
 *   canonicalPhone('+966 50 000 0000')           // '+966500000000' (formatting stripped)
 *   canonicalPhone('0500000000', 'SA')           // '+966500000000' (local + SA hint)
 *   canonicalPhone('00966500000000', 'SA')       // '+966500000000' (IDD + SA hint)
 *   canonicalPhone('0500000000')                 // null (local, no hint)
 *   canonicalPhone('00966500000000')             // null (IDD, no hint — ambiguous)
 *   canonicalPhone('not-a-phone')               // null
 */
export function canonicalPhone(
  value: string | null | undefined,
  countryHint?: string | null,
): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (raw.length === 0) return null;

  // E.164 / explicit + prefix: self-identifying international format.
  // The library resolves these without a country. Malformed → null.
  if (raw.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(raw);
    return parsed?.isValid() ? parsed.number : null;
  }

  // All other formats (00 IDD, local, national) require an explicit country.
  // Without one the number is ambiguous — never guess.
  if (!countryHint) return null;

  const parsed = parsePhoneNumberFromString(raw, countryHint.toUpperCase() as CountryCode);
  return parsed?.isValid() ? parsed.number : null;
}
