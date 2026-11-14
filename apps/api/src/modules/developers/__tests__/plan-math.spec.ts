/**
 * BRK-5 — a payment plan on a price: down payment, delivery payment, the
 * instalments and what they come to a month; a cash plan with its discount.
 */
import { PlanFrequency } from '@prisma/client';
import { planBreakdown, planProblem } from '../plan-math';

describe('planBreakdown', () => {
  it('splits the price into down payment, instalments and the delivery payment', () => {
    // 10% down, 5% at delivery, the rest over 8 years quarterly (32 instalments).
    expect(
      planBreakdown(8_000_000, {
        downPaymentPct: 10,
        years: 8,
        frequency: PlanFrequency.QUARTERLY,
        deliveryPct: 5,
        cashDiscountPct: 0,
      }),
    ).toEqual({
      total: 8_000_000,
      downPayment: 800_000,
      deliveryPayment: 400_000,
      installments: 32,
      installment: 212_500,
      monthly: 70_833.33,
      cash: false,
    });
  });

  it('reads monthly plans per month', () => {
    const b = planBreakdown(1_200_000, {
      downPaymentPct: 0,
      years: 1,
      frequency: PlanFrequency.MONTHLY,
      deliveryPct: 0,
      cashDiscountPct: 0,
    });
    expect(b).toMatchObject({ installments: 12, installment: 100_000, monthly: 100_000 });
  });

  it('a cash plan is the price less its discount, all up front', () => {
    expect(
      planBreakdown(5_000_000, {
        downPaymentPct: 100,
        years: 0,
        frequency: PlanFrequency.ANNUAL,
        deliveryPct: 0,
        cashDiscountPct: 12,
      }),
    ).toEqual({
      total: 4_400_000,
      downPayment: 4_400_000,
      deliveryPayment: 0,
      installments: 0,
      installment: 0,
      monthly: 0,
      cash: true,
    });
  });
});

describe('planProblem', () => {
  it('refuses shares that leave nothing for the instalments, and a cash plan not paid up front', () => {
    expect(
      planProblem({
        downPaymentPct: 60,
        years: 5,
        frequency: PlanFrequency.ANNUAL,
        deliveryPct: 40,
        cashDiscountPct: 0,
      }),
    ).not.toBeNull();
    expect(
      planProblem({
        downPaymentPct: 20,
        years: 0,
        frequency: PlanFrequency.ANNUAL,
        deliveryPct: 0,
        cashDiscountPct: 5,
      }),
    ).not.toBeNull();
    expect(
      planProblem({
        downPaymentPct: 10,
        years: 7,
        frequency: PlanFrequency.QUARTERLY,
        deliveryPct: 10,
        cashDiscountPct: 0,
      }),
    ).toBeNull();
  });
});
