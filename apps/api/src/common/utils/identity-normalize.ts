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

/**
 * ISO 3166-1 alpha-2 country codes the platform actively supports.
 * Used for:
 *   1. Validating Company.country on creation.
 *   2. The multi-country fallback in canonicalPhone() — when the caller's
 *      country hint fails, the function tries each supported country and
 *      resolves the number when exactly one match exists.
 *
 * Overlap note: 05XXXXXXXX numbers are valid in both SA and AE. For those
 * inputs the fallback produces two candidates and returns null; the caller's
 * hint is authoritative for that overlap. EG mobile numbers (01XXXXXXXXX,
 * 11 digits) are unambiguous across all three countries.
 */
export const SUPPORTED_COUNTRIES = ['EG', 'SA', 'AE'] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

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
/**
 * Internal implementation that accepts an explicit country list.
 * Exported only for unit tests that need to inject a custom country set to
 * construct a collision and verify the ambiguous-rejection path.
 * Production code must call canonicalPhone() which passes SUPPORTED_COUNTRIES.
 */
export function _canonicalPhoneImpl(
  value: string | null | undefined,
  countryHint: string | null | undefined,
  countries: readonly string[],
): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (raw.length === 0) return null;

  // Step 1 — E.164 / explicit + prefix: self-identifying; no country needed.
  if (raw.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(raw);
    return parsed?.isValid() ? parsed.number : null;
  }

  // Step 2 — Try the caller's explicit country hint first.
  if (countryHint) {
    const parsed = parsePhoneNumberFromString(raw, countryHint.toUpperCase() as CountryCode);
    if (parsed?.isValid()) return parsed.number;
  }

  // Step 3 — Multi-country fallback (only when a hint was supplied but failed).
  // Without a hint there is no country context and we must return null.
  if (!countryHint) return null;

  // Try every country in the list except the hint (already tried in step 2).
  // Collect ALL unique E.164 results — every country is tried regardless of order.
  const hintNorm = countryHint.toUpperCase();
  const candidates: string[] = [];
  for (const c of countries) {
    if (c === hintNorm) continue;
    const parsed = parsePhoneNumberFromString(raw, c as CountryCode);
    if (parsed?.isValid()) {
      const e164 = parsed.number;
      if (!candidates.includes(e164)) candidates.push(e164);
    }
  }

  // Three-way decision — order of iteration does not influence the result:
  //   0 matches → unparseable without a valid country hint
  //   1 unique E.164 → unambiguous (possibly multiple countries agreed on it)
  //   2+ distinct E.164 values → genuinely ambiguous across the country set; caller
  //     must supply a correct hint to resolve (e.g. 05XXXXXXXX in both SA and AE)
  if (candidates.length === 1) return candidates[0];
  return null;
}

export function canonicalPhone(
  value: string | null | undefined,
  countryHint?: string | null,
): string | null {
  return _canonicalPhoneImpl(value, countryHint, SUPPORTED_COUNTRIES);
}
