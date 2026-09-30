/**
 * Egyptian mobile-phone normalisation for the data importer.
 *
 * Why a separate module: phone is the identity key for Customer rows. A wrong
 * repair would silently merge two customers' data, so the rules must be explicit
 * and testable in isolation.
 */

export interface PhoneNormResult {
  normalized: string;
  /** true when the input was repaired (leading 0 added, country code stripped) */
  repaired: boolean;
  /** set when the phone cannot be accepted at all; empty string in normalized */
  error?: string;
}

/**
 * Normalise an Egyptian mobile phone string to the canonical 01XXXXXXXXX format.
 *
 * Rules (applied to the digit-only string):
 *   11 digits starting 01   → valid as-is
 *   10 digits starting 1    → prepend 0, mark repaired
 *   12 digits starting 201  → strip 20, prepend 0, mark repaired
 *   9–10 digits starting 2  → landline, blocking error
 *   anything else           → blocking error
 *   numeric cell type       → caller must check before calling (leading 0 already lost)
 *
 * Strips spaces, hyphens, dots, plus signs before matching.
 */
export function normalizePhone(raw: string): PhoneNormResult {
  if (!raw.trim()) {
    return { normalized: '', repaired: false, error: 'Phone is required' };
  }

  const digits = raw.replace(/[^0-9]/g, '');

  // Explicit E.164 prefix that is not Egyptian (+20) — fail fast with a clear message.
  if (raw.trimStart().startsWith('+') && !digits.startsWith('20')) {
    return {
      normalized: '',
      repaired: false,
      error: `Phone "${raw}" uses a non-Egyptian country code. This importer currently supports Egyptian mobile numbers only (+20 / 01XXXXXXXXX). Non-Egyptian tenants are not yet supported — see the roadmap note in the README sheet.`,
    };
  }

  if (/^01\d{9}$/.test(digits)) {
    return { normalized: digits, repaired: false };
  }

  if (/^1\d{9}$/.test(digits)) {
    return { normalized: `0${digits}`, repaired: true };
  }

  if (/^201\d{9}$/.test(digits)) {
    return { normalized: `0${digits.slice(2)}`, repaired: true };
  }

  if (/^2\d{8,9}$/.test(digits)) {
    return {
      normalized: '',
      repaired: false,
      error: `Phone "${raw}" appears to be an Egyptian landline (starts with 2, ${digits.length} digits). Only mobile numbers (01XXXXXXXXX) are accepted.`,
    };
  }

  return {
    normalized: '',
    repaired: false,
    error: `Phone "${raw}" is not a recognised Egyptian mobile number. Valid formats: 01XXXXXXXXX (11 digits) or +201XXXXXXXXX / 201XXXXXXXXX (12 digits).`,
  };
}

/**
 * Converts a stored phone to the importer's local 01XXXXXXXXX format.
 *
 * The auth service writes E.164 (+201XXXXXXXXX); the importer normalises to
 * 01XXXXXXXXX. This helper bridges the gap for read paths (map lookups, exports)
 * without mutating stored values — see MT-020 for the deferred full backfill.
 */
export function storedToImportPhone(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (/^\+201\d{9}$/.test(stored)) return `0${stored.slice(3)}`; // +201062800394 → 01062800394
  if (/^01\d{9}$/.test(stored)) return stored;                   // already canonical
  return null;
}
