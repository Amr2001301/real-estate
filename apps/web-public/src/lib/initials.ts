/**
 * The letters shown in an avatar: first letter of the first and the last word.
 *
 * One helper for every avatar (QA run 1, F-048 / F-010). Five separate copies
 * cut the first character by UTF-16 unit, so a name starting with an emoji was
 * split inside its surrogate pair — the server and the client then rendered
 * different text (a hydration error) — and the Arabic article «ال» was used as
 * the initial («السيد» read «ال», not «س»).
 *
 *  - only words that start with a letter count («E2E Visitor 1792…» reads EV);
 *  - the article «ال» is skipped when something follows it;
 *  - letters are taken by code point, never by UTF-16 unit;
 *  - one word gives one letter, or two when `single: 2`;
 *  - no word with a letter gives `fallback`.
 */
export function initials(
  name: string | null | undefined,
  opts: { single?: 1 | 2; fallback?: string } = {},
): string {
  const { single = 1, fallback = '؟' } = opts;
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w));
  if (words.length === 0) return fallback;
  const letters = (w: string): string[] => {
    const cps = Array.from(w);
    return cps.length > 3 && cps[0] === 'ا' && cps[1] === 'ل' ? cps.slice(2) : cps;
  };
  const first = letters(words[0]!);
  if (words.length === 1) return first.slice(0, single).join('').toUpperCase();
  const last = letters(words[words.length - 1]!);
  return (first[0]! + last[0]!).toUpperCase();
}
