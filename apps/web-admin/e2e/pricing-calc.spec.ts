import { test, expect } from '@playwright/test';
import { calculateQuote, type CalcPlan } from '../src/lib/pricing-calc';

const plans: CalcPlan[] = [
  { id: 'a', planTier: 'STARTER', name: 'Starter', annualPrice: 18000, maxUsers: 10 },
  { id: 'b', planTier: 'PROFESSIONAL', name: 'Professional', annualPrice: 30000, maxUsers: 20 },
  { id: 'c', planTier: 'ENTERPRISE', name: 'Enterprise', annualPrice: 75000, maxUsers: null },
];
const base = { plans, years: 1, extraUserPrice: 1500, discountPct: 0 };

test.describe('pricing calculator', () => {
  test('picks the smallest plan that fits the staff count', () => {
    expect(calculateQuote({ ...base, users: 8 })).toMatchObject({ kind: 'plan', planName: 'Starter', perYear: 18000 });
    expect(calculateQuote({ ...base, users: 10 })).toMatchObject({ planName: 'Starter' });
    expect(calculateQuote({ ...base, users: 11 })).toMatchObject({ planName: 'Professional', perYear: 30000 });
    expect(calculateQuote({ ...base, users: 20 })).toMatchObject({ planName: 'Professional' });
  });

  test('above the largest limited plan it builds a custom price from extra users', () => {
    const r = calculateQuote({ ...base, users: 30 })!;
    expect(r.kind).toBe('custom');
    expect(r.extraUsers).toBe(10);
    expect(r.perYear).toBe(30000 + 10 * 1500);
  });

  test('never charges more than the unlimited plan', () => {
    const r = calculateQuote({ ...base, users: 100 })!;
    expect(r.kind).toBe('unlimited');
    expect(r.perYear).toBe(75000);
    expect(r.perUserPerYear).toBeNull();
  });

  test('multi-year totals and the discount apply to the whole subscription', () => {
    const r = calculateQuote({ ...base, users: 10, years: 2, discountPct: 10 })!;
    expect(r.total).toBe(32400); // 18,000 x 2 = 36,000 less 10%
    expect(r.discount).toBe(3600);
    expect(r.perUserPerYear).toBe(1620);
  });

  test('rejects an empty or unpriced input', () => {
    expect(calculateQuote({ ...base, users: 0 })).toBeNull();
    expect(calculateQuote({ ...base, plans: [], users: 5 })).toBeNull();
  });
});
