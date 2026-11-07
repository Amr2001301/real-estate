import { Prisma } from '@prisma/client';

/**
 * Project-level instalment plans.
 *
 * A plan has one of three scopes, from most to least specific:
 *   UNIT     — `unitId` set: that unit's own plan (absolute amounts at its price);
 *   TYPE     — no unit, `unitTypes` listed: the project's units of those types;
 *   PROJECT  — no unit, no types: every unit of the project.
 * TYPE and PROJECT plans are priced by percentages and worked out per unit at
 * reservation time (`materializePlan`). A unit takes the plans of the most
 * specific scope that has any live plan for it — a unit's own plan overrides the
 * type's, which overrides the project's (`pickApplicablePlans`). Several plans
 * of the winning scope are all offered.
 */

export type PlanScope = 'UNIT' | 'TYPE' | 'PROJECT';

export interface ScopedPlanFields {
  unitId: string | null;
  projectId: string;
  unitTypes: string[];
  status: string;
  validFrom: Date | null;
  validTo: Date | null;
}

export interface UnitForPlans {
  id: string;
  type: string;
  price: Prisma.Decimal | number | string;
  projectId: string;
}

export function scopeOf(plan: Pick<ScopedPlanFields, 'unitId' | 'unitTypes'>): PlanScope {
  if (plan.unitId) return 'UNIT';
  return plan.unitTypes.length > 0 ? 'TYPE' : 'PROJECT';
}

/** Offered today: ACTIVE and inside its validity window (either end may be open). */
export function isLive(plan: Pick<ScopedPlanFields, 'status' | 'validFrom' | 'validTo'>, now: Date): boolean {
  if (plan.status !== 'ACTIVE') return false;
  if (plan.validFrom && now < plan.validFrom) return false;
  if (plan.validTo && now > endOfDay(plan.validTo)) return false;
  return true;
}

/** `validTo` is a date: the plan is offered through the whole of that day. */
function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setUTCHours(23, 59, 59, 999);
  return e;
}

/** Does the plan's scope include this unit (project, unit and unit types)? */
export function covers(plan: Pick<ScopedPlanFields, 'unitId' | 'projectId' | 'unitTypes'>, unit: UnitForPlans): boolean {
  if (plan.projectId !== unit.projectId) return false;
  if (plan.unitId) return plan.unitId === unit.id;
  return plan.unitTypes.length === 0 || plan.unitTypes.includes(unit.type);
}

/**
 * The plans a unit takes: the live plans that cover it, of the most specific
 * scope that has any. `scope` is null when nothing applies.
 */
export function pickApplicablePlans<P extends ScopedPlanFields>(
  plans: P[],
  unit: UnitForPlans,
  now: Date,
): { scope: PlanScope | null; plans: P[] } {
  const live = plans.filter((p) => isLive(p, now) && covers(p, unit));
  for (const scope of ['UNIT', 'TYPE', 'PROJECT'] as const) {
    const of = live.filter((p) => scopeOf(p) === scope);
    if (of.length > 0) return { scope, plans: of };
  }
  return { scope: null, plans: [] };
}

export interface PlanMoney {
  unitId: string | null;
  totalPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  discountType: 'FIXED' | 'PERCENTAGE';
  discountValue: Prisma.Decimal;
  netPrice: Prisma.Decimal;
  reservationAmount: Prisma.Decimal;
  reservationAmountType: 'FIXED' | 'PERCENTAGE';
  reservationAmountValue: Prisma.Decimal;
  downPaymentType: 'FIXED' | 'PERCENTAGE';
  downPaymentValue: Prisma.Decimal;
  downPaymentAmount: Prisma.Decimal;
  finalPaymentAmount: Prisma.Decimal | null;
  isCash: boolean;
}

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const cents = (d: Prisma.Decimal) => d.toDecimalPlaces(2);

/**
 * The plan's amounts on a given unit price. A unit's own plan already holds
 * absolute amounts and comes back unchanged. A TYPE / PROJECT plan holds
 * percentages, worked out here:
 *   total       = the unit's price
 *   discount    = % of the price
 *   net         = total − discount
 *   booking     = % of the unit's price (what the reservation charges) or the fixed amount
 *   down payment= % of net (cash: everything the booking leaves)
 * and no final payment (a fixed balloon does not scale across prices).
 */
export function materializePlan<T extends PlanMoney>(plan: T, unitPrice: Prisma.Decimal.Value): T {
  if (plan.unitId) return plan;
  const total = D(unitPrice);
  const discount = cents(plan.discountType === 'PERCENTAGE' ? total.mul(plan.discountValue).div(100) : D(plan.discountValue));
  const net = total.sub(discount);
  const booking = cents(
    plan.reservationAmountType === 'PERCENTAGE' ? total.mul(plan.reservationAmountValue).div(100) : D(plan.reservationAmountValue),
  );
  const down = plan.isCash
    ? cents(net.sub(booking)).clamp(0, net)
    : cents(plan.downPaymentType === 'PERCENTAGE' ? net.mul(plan.downPaymentValue).div(100) : D(plan.downPaymentValue));
  return {
    ...plan,
    totalPrice: total,
    discountAmount: discount,
    netPrice: net,
    reservationAmount: booking,
    downPaymentAmount: down,
    finalPaymentAmount: null,
  };
}

/**
 * What a TYPE / PROJECT plan must look like when it is saved: percentages only
 * (a fixed discount or down payment cannot fit units of different prices), no
 * final payment, and booking + down payment inside the net price.
 * Returns the problem in Arabic, or null when the plan is sound.
 */
export function scopedPlanProblem(p: {
  isCash: boolean;
  discountType: 'FIXED' | 'PERCENTAGE';
  discountValue: number;
  reservationAmountType: 'FIXED' | 'PERCENTAGE';
  reservationAmountValue: number;
  downPaymentType?: 'FIXED' | 'PERCENTAGE';
  downPaymentValue?: number;
  finalPaymentAmount?: number | null;
}): string | null {
  if (p.discountType !== 'PERCENTAGE') return 'خطة المشروع تحدّد الخصم كنسبة مئوية (المبلغ الثابت لا يصلح لوحدات بأسعار مختلفة)';
  if (p.discountValue < 0 || p.discountValue > 100) return 'نسبة الخصم يجب أن تكون بين صفر و100';
  if ((p.finalPaymentAmount ?? 0) > 0) return 'الدفعة الأخيرة بمبلغ ثابت لا تصلح لخطة المشروع — استخدم خطة وحدة محددة';
  if (p.reservationAmountValue <= 0) return 'دفعة الحجز يجب أن تكون أكبر من صفر';
  if (p.reservationAmountType === 'PERCENTAGE' && p.reservationAmountValue > 100) return 'نسبة دفعة الحجز يجب أن تكون أكبر من صفر وحتى 100';
  if (!p.isCash) {
    if (p.downPaymentType !== 'PERCENTAGE') return 'خطة المشروع تحدّد المقدم كنسبة مئوية';
    const dp = p.downPaymentValue ?? 0;
    if (dp <= 0 || dp > 100) return 'نسبة المقدم يجب أن تكون أكبر من صفر وحتى 100';
    // Worst case a fixed booking is checked against: the booking is a share of
    // the price, so only the percentages can be compared here.
    if (p.reservationAmountType === 'PERCENTAGE') {
      const net = 100 - p.discountValue;
      const booking = p.reservationAmountValue; // % of price
      const down = (net * dp) / 100;
      if (booking + down > net) return 'مبلغ الحجز + المقدم يتجاوزان صافي السعر';
    }
  }
  return null;
}
