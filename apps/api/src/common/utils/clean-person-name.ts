/**
 * Takes the characters out of a typed name that change how it is drawn instead
 * of what it says: bidi overrides, embeddings and isolates (U+202A–U+202E,
 * U+2066–U+2069), zero-width space and the byte-order mark (U+200B, U+FEFF).
 * A name carrying them can be shown reversed or invisible to staff (spoofing),
 * QA run 1, F-046.
 *
 * Kept on purpose: the left/right marks (U+200E/U+200F) and the zero-width
 * joiners (U+200C/U+200D), which ordinary Arabic and Persian writing uses.
 */
const SPOOFING = /[‪-‮⁦-⁩​﻿]/g;

export function cleanPersonName(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(SPOOFING, '').replace(/\s+/g, ' ').trim();
}
