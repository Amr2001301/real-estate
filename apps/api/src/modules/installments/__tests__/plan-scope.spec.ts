import { Prisma } from '@prisma/client';
import {
  covers,
  isLive,
  materializePlan,
  pickApplicablePlans,
  scopeOf,
  scopedPlanProblem,
  type PlanMoney,
  type ScopedPlanFields,
} from '../plan-scope';

const D = (n: number | string) => new Prisma.Decimal(n);
const NOW = new Date('2026-11-07T10:00:00Z');

function plan(over: Partial<ScopedPlanFields & PlanMoney> & { id?: string } = {}): ScopedPlanFields & PlanMoney & { id: string } {
  return {
    id: 'p',
    unitId: null,
    projectId: 'proj-1',
    unitTypes: [],
    status: 'ACTIVE',
    validFrom: null,
    validTo: null,
    totalPrice: D(0),
    discountAmount: D(0),
    discountType: 'PERCENTAGE',
    discountValue: D(5),
    netPrice: D(0),
    reservationAmount: D(0),
    reservationAmountType: 'PERCENTAGE',
    reservationAmountValue: D(2),
    downPaymentType: 'PERCENTAGE',
    downPaymentValue: D(10),
    downPaymentAmount: D(0),
    finalPaymentAmount: null,
    isCash: false,
    ...over,
  };
}
const unit = { id: 'u1', type: '2BR', price: 3_600_000, projectId: 'proj-1' };

describe('scope', () => {
  it('UNIT / TYPE / PROJECT', () => {
    expect(scopeOf(plan({ unitId: 'u1' }))).toBe('UNIT');
    expect(scopeOf(plan({ unitTypes: ['2BR'] }))).toBe('TYPE');
    expect(scopeOf(plan())).toBe('PROJECT');
  });

  it('covers: same project, the unit, or its type', () => {
    expect(covers(plan(), unit)).toBe(true);
    expect(covers(plan({ projectId: 'other' }), unit)).toBe(false);
    expect(covers(plan({ unitTypes: ['2BR', '3BR'] }), unit)).toBe(true);
    expect(covers(plan({ unitTypes: ['Office'] }), unit)).toBe(false);
    expect(covers(plan({ unitId: 'u1' }), unit)).toBe(true);
    expect(covers(plan({ unitId: 'u2' }), unit)).toBe(false);
  });
});

describe('validity', () => {
  it('only ACTIVE plans inside their dates are live; validTo runs to the end of that day', () => {
    expect(isLive(plan(), NOW)).toBe(true);
    expect(isLive(plan({ status: 'DRAFT' }), NOW)).toBe(false);
    expect(isLive(plan({ validFrom: new Date('2026-11-08') }), NOW)).toBe(false);
    expect(isLive(plan({ validFrom: new Date('2026-11-01') }), NOW)).toBe(true);
    expect(isLive(plan({ validTo: new Date('2026-11-06') }), NOW)).toBe(false);
    expect(isLive(plan({ validTo: new Date('2026-11-07') }), NOW)).toBe(true); // the whole last day
  });
});

describe('priority: unit > type > project, several plans of the winning scope', () => {
  const proj = plan({ id: 'proj' });
  const projB = plan({ id: 'projB' });
  const type = plan({ id: 'type', unitTypes: ['2BR'] });
  const own = plan({ id: 'own', unitId: 'u1' });

  it('a unit with its own plan takes only that', () => {
    const r = pickApplicablePlans([proj, type, own], unit, NOW);
    expect(r.scope).toBe('UNIT');
    expect(r.plans.map((p) => p.id)).toEqual(['own']);
  });

  it('else the type plans, else the project plans', () => {
    expect(pickApplicablePlans([proj, type], unit, NOW).plans.map((p) => p.id)).toEqual(['type']);
    expect(pickApplicablePlans([proj], unit, NOW).scope).toBe('PROJECT');
    expect(pickApplicablePlans([proj, type], { ...unit, type: 'Office' }, NOW).plans.map((p) => p.id)).toEqual(['proj']);
  });

  it('several plans of the same scope are all offered', () => {
    expect(pickApplicablePlans([proj, projB], unit, NOW).plans.map((p) => p.id)).toEqual(['proj', 'projB']);
  });

  it('an expired winner falls through to the next scope; nothing live gives null', () => {
    const expiredOwn = plan({ id: 'own', unitId: 'u1', validTo: new Date('2026-01-01') });
    expect(pickApplicablePlans([expiredOwn, type], unit, NOW).plans.map((p) => p.id)).toEqual(['type']);
    expect(pickApplicablePlans([expiredOwn], unit, NOW)).toEqual({ scope: null, plans: [] });
  });
});

describe('materializePlan — percentages on the unit price', () => {
  it('discount % of the price, booking % of the price, down payment % of the net', () => {
    const m = materializePlan(plan(), 3_600_000);
    expect(m.totalPrice.toString()).toBe('3600000');
    expect(m.discountAmount.toString()).toBe('180000'); // 5%
    expect(m.netPrice.toString()).toBe('3420000');
    expect(m.reservationAmount.toString()).toBe('72000'); // 2% of the price (what a reservation charges)
    expect(m.downPaymentAmount.toString()).toBe('342000'); // 10% of net
    expect(m.finalPaymentAmount).toBeNull();
  });

  it('the same plan on a cheaper unit scales', () => {
    const m = materializePlan(plan(), 2_400_000);
    expect(m.netPrice.toString()).toBe('2280000');
    expect(m.downPaymentAmount.toString()).toBe('228000');
  });

  it('a fixed booking is the same on every unit', () => {
    const p = plan({ reservationAmountType: 'FIXED', reservationAmountValue: D(50_000) });
    expect(materializePlan(p, 3_600_000).reservationAmount.toString()).toBe('50000');
    expect(materializePlan(p, 2_400_000).reservationAmount.toString()).toBe('50000');
  });

  it('cash: the down payment is everything the booking leaves', () => {
    const m = materializePlan(plan({ isCash: true }), 1_000_000);
    expect(m.netPrice.toString()).toBe('950000');
    expect(m.reservationAmount.toString()).toBe('20000');
    expect(m.downPaymentAmount.toString()).toBe('930000');
    expect(m.reservationAmount.add(m.downPaymentAmount).toString()).toBe(m.netPrice.toString());
  });

  it("a unit's own plan comes back unchanged", () => {
    const own = plan({ unitId: 'u1', netPrice: D(123) });
    expect(materializePlan(own, 999)).toBe(own);
  });
});

describe('scopedPlanProblem', () => {
  const ok = {
    isCash: false,
    discountType: 'PERCENTAGE' as const,
    discountValue: 5,
    reservationAmountType: 'PERCENTAGE' as const,
    reservationAmountValue: 2,
    downPaymentType: 'PERCENTAGE' as const,
    downPaymentValue: 10,
  };
  it('a sound percentage plan is accepted', () => expect(scopedPlanProblem(ok)).toBeNull());
  it('refuses a fixed discount, a fixed down payment, a final payment and over-100 shares', () => {
    expect(scopedPlanProblem({ ...ok, discountType: 'FIXED' })).toMatch(/نسبة مئوية/);
    expect(scopedPlanProblem({ ...ok, downPaymentType: 'FIXED' })).toMatch(/المقدم/);
    expect(scopedPlanProblem({ ...ok, finalPaymentAmount: 1000 })).toMatch(/الدفعة الأخيرة/);
    expect(scopedPlanProblem({ ...ok, reservationAmountValue: 0 })).toMatch(/الحجز/);
    expect(scopedPlanProblem({ ...ok, discountValue: 120 })).toMatch(/الخصم/);
    expect(scopedPlanProblem({ ...ok, reservationAmountValue: 95, downPaymentValue: 50 })).toMatch(/يتجاوزان/);
  });
  it('a cash plan needs no down payment', () => {
    expect(scopedPlanProblem({ ...ok, isCash: true, downPaymentType: undefined, downPaymentValue: undefined })).toBeNull();
  });
});
