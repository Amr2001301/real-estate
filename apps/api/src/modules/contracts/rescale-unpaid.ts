/**
 * Spread a price change over the unpaid installments, in proportion to their
 * amounts; the last one takes the rounding. Returns the new amounts, in the
 * same order, or null when the unpaid amount cannot absorb a reduction.
 */
export function rescaleUnpaid(amounts: number[], delta: number): number[] | null {
  const cents = amounts.map((a) => Math.round(a * 100));
  const total = cents.reduce((a, c) => a + c, 0);
  const target = total + Math.round(delta * 100);
  if (target < 0 || (total === 0 && target !== 0)) return null;
  if (total === 0) return amounts.map(() => 0);
  const out: number[] = [];
  let used = 0;
  cents.forEach((c, i) => {
    const v = i === cents.length - 1 ? target - used : Math.round((c * target) / total);
    used += v;
    out.push(v / 100);
  });
  return out.some((v) => v < 0) ? null : out;
}
