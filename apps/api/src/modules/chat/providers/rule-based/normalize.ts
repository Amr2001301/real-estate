/**
 * Arabic-first text normalization for deterministic intent/slot matching.
 * Folds the many ways the same word can be typed (diacritics, alef variants,
 * Arabic-Indic vs ASCII digits, tatweel, casing, whitespace) into one canonical
 * form so the keyword dictionaries can stay small and readable.
 *
 * Pure functions only — no I/O, no state.
 */

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;
const TATWEEL = /ـ/g;

// Arabic-Indic (٠-٩) and Extended/Persian (۰-۹) digit code points.
const ARABIC_INDIC_BASE = 0x0660;
const EXTENDED_ARABIC_BASE = 0x06f0;

/** Convert any Arabic-Indic / Persian digit to its ASCII equivalent. */
export function foldDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const base = code >= EXTENDED_ARABIC_BASE ? EXTENDED_ARABIC_BASE : ARABIC_INDIC_BASE;
    return String(code - base);
  });
}

/**
 * Canonical form used for matching. Lower-cases latin, strips diacritics and
 * tatweel, unifies alef/hamza/ya/ta-marbuta variants, folds digits, and
 * collapses whitespace. Kept deliberately lossy — good for matching, not for
 * display (never echo this back to the user).
 */
export function normalizeArabic(input: string): string {
  return foldDigits(input)
    .toLowerCase()
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `haystack` contains any of the (already-normalized) needles. */
export function containsAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}
