/**
 * What the customer pays before the first instalment: the booking amount comes
 * on top of the plan's down payment, so «مقدم 10%» can read as more than 10% up
 * front. Null when either part is missing, so the screen shows no extra line.
 */
export function upfrontTotal(
  bookingAmount: number | string | null | undefined,
  downPayment: number | string | null | undefined,
): number | null {
  const booking = Number(bookingAmount ?? 0);
  const down = Number(downPayment ?? 0);
  if (!Number.isFinite(booking) || !Number.isFinite(down)) return null;
  if (booking <= 0 || down <= 0) return null;
  return Math.round((booking + down) * 100) / 100;
}
