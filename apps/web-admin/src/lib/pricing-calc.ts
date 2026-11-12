/**
 * Price calculator for a quotation: how much a company with N staff users pays for a subscription of
 * Y years. Fixed plans (10 / 20 users / unlimited) are used as they are; above the largest limited
 * plan a custom price is built from that plan plus a price per extra user, and it never exceeds the
 * unlimited plan (past that point, unlimited is simply the better offer).
 */

export interface CalcPlan {
  id: string;
  planTier: string;
  name: string;
  /** Annual price; null when the plan has none. */
  annualPrice: number | null;
  /** Staff-user limit; null = unlimited. */
  maxUsers: number | null;
}

export interface CalcInput {
  plans: CalcPlan[];
  users: number;
  years: number;
  /** Price per extra staff user per year, above the largest limited plan. */
  extraUserPrice: number;
  /** Discount on the whole subscription, 0–100. */
  discountPct: number;
  /** Optional assistant add-on: a monthly price, billed for every month of the subscription. */
  aiMonthlyPrice?: number;
}

export interface CalcResult {
  /** `plan`: a listed plan fits; `custom`: built from the largest plan plus extra users; `unlimited`: capped. */
  kind: 'plan' | 'custom' | 'unlimited';
  planName: string;
  extraUsers: number;
  /** Annual price before the discount. */
  perYear: number;
  /** The whole subscription after the discount. */
  total: number;
  discount: number;
  /** Assistant add-on over the whole subscription (0 when none); not discounted. */
  aiTotal: number;
  /** Subscription after the discount plus the add-on. */
  grandTotal: number;
  /** What one staff user costs per year (after the discount); null for unlimited. */
  perUserPerYear: number | null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function calculateQuote(input: CalcInput): CalcResult | null {
  const users = Math.floor(input.users);
  if (!Number.isFinite(users) || users < 1) return null;
  const years = clamp(Math.floor(input.years) || 1, 1, 20);
  const discountPct = clamp(Number(input.discountPct) || 0, 0, 100);
  const extra = Math.max(0, Number(input.extraUserPrice) || 0);

  const priced = input.plans.filter((p) => p.annualPrice !== null);
  const limited = priced.filter((p) => p.maxUsers !== null).sort((a, b) => (a.maxUsers as number) - (b.maxUsers as number));
  const unlimited = priced.find((p) => p.maxUsers === null) ?? null;
  if (limited.length === 0 && !unlimited) return null;

  let kind: CalcResult['kind'] = 'plan';
  let planName = '';
  let perYear = 0;
  let extraUsers = 0;

  const fit = limited.find((p) => (p.maxUsers as number) >= users);
  if (fit) {
    planName = fit.name;
    perYear = fit.annualPrice as number;
  } else {
    const top = limited[limited.length - 1];
    if (top) {
      extraUsers = users - (top.maxUsers as number);
      const customPrice = (top.annualPrice as number) + extraUsers * extra;
      if (unlimited && customPrice >= (unlimited.annualPrice as number)) {
        kind = 'unlimited';
        planName = unlimited.name;
        perYear = unlimited.annualPrice as number;
        extraUsers = 0;
      } else {
        kind = 'custom';
        planName = top.name;
        perYear = customPrice;
      }
    } else if (unlimited) {
      kind = 'unlimited';
      planName = unlimited.name;
      perYear = unlimited.annualPrice as number;
    }
  }

  const gross = perYear * years;
  const discount = Math.round(gross * (discountPct / 100));
  const total = gross - discount;
  const aiTotal = Math.max(0, Number(input.aiMonthlyPrice) || 0) * 12 * years;
  return {
    kind,
    planName,
    extraUsers,
    perYear,
    total,
    discount,
    aiTotal,
    grandTotal: total + aiTotal,
    perUserPerYear: kind === 'unlimited' ? null : Math.round(total / years / users),
  };
}
