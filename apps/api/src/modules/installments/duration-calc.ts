/**
 * Single source of truth for installment-plan duration calculations.
 *
 * Formula:
 *   remainingAmount     = netPrice - reservationAmount - downPaymentAmount - finalPaymentAmount
 *   financedAmount      = remainingAmount * (1 + increasePercentage / 100)
 *   monthlyInstallment  = financedAmount / durationMonths, rounded down to the cent
 *   lastInstallment     = financedAmount - monthlyInstallment * (durationMonths - 1)
 *   totalPayable        = reservationAmount + downPaymentAmount + financedAmount + finalPaymentAmount
 *
 * The final (balloon) payment is its own row on the schedule, so it is taken
 * out before the monthly split — leaving it in billed it twice. Money is
 * worked in cents: the monthly rows are equal and the last one carries the
 * rounding, so the schedule always adds up to totalPayable exactly.
 *
 * Balloon plans (a big payment every 3, 6 or 12 months beside a small or
 * zero monthly one): `balloon.sharePct` of the financed amount is paid in
 * equal big payments, one at the end of every `balloon.everyMonths` months;
 * the rest is paid monthly. The cents left by the equal split go on the last
 * monthly row (on the last big payment when there is no monthly part), so
 * the rows still add up to totalPayable exactly. `monthlyInstallment` is then
 * the small monthly amount and `balloonAmount` each big payment.
 *
 * Inputs are accepted as plain numbers; callers are responsible for
 * converting Prisma Decimal to number before passing in.
 */

export interface DurationCalcInput {
  netPrice: number;
  reservationAmount: number;
  downPaymentAmount: number;
  durationMonths: number;
  increasePercentage: number;
  /** The balloon payment due after the last month; 0 or absent when none. */
  finalPaymentAmount?: number;
  /** A big payment every few months beside the monthly one; absent = an ordinary plan. */
  balloon?: BalloonTerms | null;
}

export interface BalloonTerms {
  /** Share of the financed amount paid in the big payments, 1–100. */
  sharePct: number;
  /** Months between two big payments: 3, 6 or 12. */
  everyMonths: number;
}

/** The months a big payment may fall apart. */
export const BALLOON_EVERY_MONTHS = [3, 6, 12] as const;

/** A plan's balloon terms, or null for an ordinary plan. */
export function balloonOf(plan: { balloonSharePct?: { toString(): string } | number | null; balloonEveryMonths?: number | null }): BalloonTerms | null {
  const share = plan.balloonSharePct == null ? 0 : Number(plan.balloonSharePct);
  const every = plan.balloonEveryMonths ?? 0;
  return share > 0 && every > 0 ? { sharePct: share, everyMonths: every } : null;
}

/** Why balloon terms do not fit a duration, or null when they do. */
export function balloonProblem(b: BalloonTerms, durationMonths: number): string | null {
  if (!(b.sharePct > 0 && b.sharePct <= 100)) return 'نسبة الدفعات الكبيرة يجب أن تكون أكبر من صفر وحتى 100%';
  if (!(BALLOON_EVERY_MONTHS as readonly number[]).includes(b.everyMonths)) return 'الدفعة الكبيرة تكون كل 3 أو 6 أو 12 شهرًا';
  if (durationMonths % b.everyMonths !== 0) {
    return `مدة ${durationMonths} شهرًا لا تنقسم على دفعة كل ${b.everyMonths} أشهر — اختر مدة من مضاعفات ${b.everyMonths}`;
  }
  return null;
}

export interface DurationCalcResult {
  remainingAmount: number;
  financedAmount: number;
  monthlyInstallment: number;
  /** The last monthly row: the monthly amount plus the rounding remainder. */
  lastInstallment: number;
  finalPaymentAmount: number;
  totalPayable: number;
  /** Balloon plan: each big payment (0 when none), how many, and how far apart. */
  balloonAmount: number;
  /** The last big payment: carries the rounding when there is no monthly part. */
  lastBalloon: number;
  balloonCount: number;
  balloonEveryMonths: number;
}

const toCents = (n: number) => Math.round(n * 100);

export function computeDurationOption(input: DurationCalcInput): DurationCalcResult {
  const reservation = toCents(input.reservationAmount);
  const down = toCents(input.downPaymentAmount);
  const final = toCents(input.finalPaymentAmount ?? 0);
  const remaining = Math.max(0, toCents(input.netPrice) - reservation - down - final);
  const financed = Math.round(remaining * (1 + input.increasePercentage / 100));
  const months = input.durationMonths;
  const split = splitFinanced(financed, months, input.balloon ?? null);
  return {
    remainingAmount: remaining / 100,
    financedAmount: financed / 100,
    monthlyInstallment: split.monthly / 100,
    lastInstallment: split.lastMonthly / 100,
    finalPaymentAmount: final / 100,
    totalPayable: (reservation + down + financed + final) / 100,
    balloonAmount: split.balloon / 100,
    lastBalloon: split.lastBalloon / 100,
    balloonCount: split.balloonCount,
    balloonEveryMonths: split.balloonCount > 0 ? input.balloon!.everyMonths : 0,
  };
}

/**
 * The financed amount (in cents) split into the monthly rows and, for a
 * balloon plan, the big payments. Terms that do not fit the duration give an
 * ordinary split — callers validate them first (`balloonProblem`).
 */
export function splitFinanced(financed: number, months: number, balloon: BalloonTerms | null) {
  if (months <= 0) return { monthly: 0, lastMonthly: 0, balloon: 0, lastBalloon: 0, balloonCount: 0 };
  const fits = !!balloon && balloonProblem(balloon, months) === null;
  const balloonCount = fits ? months / balloon!.everyMonths : 0;
  const balloonEach = fits ? Math.floor(Math.round((financed * balloon!.sharePct) / 100) / balloonCount) : 0;
  const monthlyPart = financed - balloonEach * balloonCount;
  const monthly = Math.floor(monthlyPart / months);
  const remainder = monthlyPart - monthly * months;
  // The cents left go on the last monthly row — or on the last big payment
  // when the whole amount is in big payments (no monthly row of a few cents).
  if (monthly === 0 && balloonCount > 0) {
    return { monthly: 0, lastMonthly: 0, balloon: balloonEach, lastBalloon: balloonEach + remainder, balloonCount };
  }
  return { monthly, lastMonthly: monthly + remainder, balloon: balloonEach, lastBalloon: balloonEach, balloonCount };
}

/**
 * The financed rows of a contract, in order: one per month (index 0 = the
 * start month) and, for a balloon plan, a big payment at the end of every
 * `everyMonths` months (on the same month as that month's row). Amounts in
 * cents; rows of 0 are left out.
 */
export function financedRows(financed: number, months: number, monthly: number, balloon: { amount: number; everyMonths: number } | null) {
  const count = balloon && balloon.amount > 0 && balloon.everyMonths > 0 && months % balloon.everyMonths === 0 ? months / balloon.everyMonths : 0;
  const balloonTotal = count * (balloon?.amount ?? 0);
  // No monthly part only in a balloon plan; an ordinary plan always has its rows.
  const monthlyRows = monthly > 0 || count === 0 ? months : 0;
  const remainder = financed - balloonTotal - monthly * monthlyRows;
  const rows: Array<{ monthIndex: number; cents: number; balloon: boolean }> = [];
  for (let i = 0; i < months; i++) {
    if (monthlyRows > 0) {
      const cents = i === months - 1 ? monthly + remainder : monthly;
      if (cents > 0) rows.push({ monthIndex: i, cents, balloon: false });
    }
    if (count > 0 && (i + 1) % balloon!.everyMonths === 0) {
      const last = i === months - 1;
      const cents = balloon!.amount + (last && monthlyRows === 0 ? remainder : 0);
      if (cents > 0) rows.push({ monthIndex: i, cents, balloon: true });
    }
  }
  return rows;
}
