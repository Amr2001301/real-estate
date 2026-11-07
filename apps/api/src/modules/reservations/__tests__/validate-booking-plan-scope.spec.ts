import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReservationsService } from '../reservations.module';

// Project-level plans (F-019 / F-039): a project / unit-type plan holds
// percentages; the reservation reads its amounts on THIS unit's price.
const D = (n: number | string) => new Prisma.Decimal(n);

function planRow(over: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    status: 'ACTIVE',
    projectId: 'proj-1',
    unitId: null,
    percentPriced: true,
    unitTypes: [],
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
    installmentsCount: null,
    frequency: 'MONTHLY',
    isCash: false,
    durationOptions: [{ id: 'o1', durationMonths: 84, increasePercentage: D(0) }],
    ...over,
  };
}

function service(plan: ReturnType<typeof planRow> | null, unit: { price: number; type: string } | null) {
  const svc = Object.create(ReservationsService.prototype) as ReservationsService;
  (svc as unknown as { prisma: unknown }).prisma = {
    installmentPlanTemplate: { findUnique: jest.fn().mockResolvedValue(plan) },
    unit: { findUnique: jest.fn().mockResolvedValue(unit) },
  };
  return svc;
}

describe('ReservationsService.validateBookingPlan — project / unit-type plans', () => {
  it('works the amounts out on the unit price', async () => {
    const out = await service(planRow(), { price: 3_600_000, type: '2BR' }).validateBookingPlan('plan-1', 'u1', 'proj-1');
    expect(out.netPrice.toString()).toBe('3420000'); // 5% off
    expect(out.reservationAmount.toString()).toBe('72000'); // 2% of the price
    expect(out.downPaymentAmount.toString()).toBe('342000'); // 10% of net
  });

  it('the same plan on a cheaper unit gives that unit its own numbers', async () => {
    const out = await service(planRow(), { price: 2_400_000, type: '1BR' }).validateBookingPlan('plan-1', 'u2', 'proj-1');
    expect(out.netPrice.toString()).toBe('2280000');
    expect(out.reservationAmount.toString()).toBe('48000');
  });

  it('a unit-type plan is for those types only', async () => {
    const svc = service(planRow({ unitTypes: ['Office'] }), { price: 1_000_000, type: '2BR' });
    await expect(svc.validateBookingPlan('plan-1', 'u1', 'proj-1')).rejects.toThrow(/نوع هذه الوحدة/);
    const ok = service(planRow({ unitTypes: ['2BR'] }), { price: 1_000_000, type: '2BR' });
    await expect(ok.validateBookingPlan('plan-1', 'u1', 'proj-1')).resolves.toBeTruthy();
  });

  it('a plan outside its dates is not sold', async () => {
    const expired = service(planRow({ validTo: new Date('2020-01-01') }), { price: 1_000_000, type: '2BR' });
    await expect(expired.validateBookingPlan('plan-1', 'u1', 'proj-1')).rejects.toThrow(/صلاحيتها/);
    const notYet = service(planRow({ validFrom: new Date('2999-01-01') }), { price: 1_000_000, type: '2BR' });
    await expect(notYet.validateBookingPlan('plan-1', 'u1', 'proj-1')).rejects.toThrow(BadRequestException);
  });

  it('still refuses another project, an inactive plan, and another unit\'s own plan', async () => {
    await expect(service(planRow(), { price: 1, type: 'x' }).validateBookingPlan('plan-1', 'u1', 'proj-OTHER')).rejects.toThrow(/مشروع/);
    await expect(service(planRow({ status: 'DRAFT' }), { price: 1, type: 'x' }).validateBookingPlan('plan-1', 'u1', 'proj-1')).rejects.toThrow(/غير مفعّلة/);
    await expect(service(planRow({ unitId: 'other-unit' }), { price: 1, type: 'x' }).validateBookingPlan('plan-1', 'u1', 'proj-1')).rejects.toThrow(/وحدة مختلفة/);
  });

  it('an older unit-less plan (absolute amounts) is used exactly as stored — nothing is worked out', async () => {
    const legacy = planRow({
      percentPriced: false,
      discountType: 'FIXED',
      discountValue: D(0),
      netPrice: D(1_000_000),
      reservationAmount: D(50_000),
      reservationAmountType: 'FIXED',
      reservationAmountValue: D(0),
      downPaymentAmount: D(200_000),
    });
    const out = await service(legacy, { price: 3_600_000, type: '2BR' }).validateBookingPlan('plan-1', 'u1', 'proj-1');
    expect(out.reservationAmount.toString()).toBe('50000');
    expect(out.netPrice.toString()).toBe('1000000');
    expect(out.downPaymentAmount.toString()).toBe('200000');
  });

  it("a unit's own plan keeps its stored amounts (and the stale-price guard)", async () => {
    const own = planRow({ unitId: 'u1', totalPrice: D(3_600_000), netPrice: D(3_420_000), reservationAmount: D(100_000), downPaymentAmount: D(360_000) });
    const out = await service(own, { price: 3_600_000, type: '2BR' }).validateBookingPlan('plan-1', 'u1', 'proj-1');
    expect(out.reservationAmount.toString()).toBe('100000');
    await expect(service(own, { price: 3_700_000, type: '2BR' }).validateBookingPlan('plan-1', 'u1', 'proj-1')).rejects.toThrow(/تغيّر سعر الوحدة/);
  });
});
