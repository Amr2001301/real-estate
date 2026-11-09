import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PlanTemplatesService } from '../installments.module';

jest.mock('../../../common/tenant/tenant-context', () => ({
  ...jest.requireActual('../../../common/tenant/tenant-context'),
  getRequiredCompanyId: () => 'c0000000-0000-4000-8000-000000000001',
}));

// Project-level plans (F-019 / F-039): created without a unit, priced by percentages.
const PROJECT = 'a1111111-1111-4111-8111-111111111111';
const D = (n: number | string) => new Prisma.Decimal(n);

function make(opts: { unitTypes?: string[]; existing?: Record<string, unknown> } = {}) {
  const created: Record<string, unknown>[] = [];
  const stored = {
    id: 'plan-new',
    name: 'x',
    description: null,
    projectId: PROJECT,
    unitId: null,
    percentPriced: true,
    unitTypes: [],
    status: 'DRAFT',
    isCash: false,
    discountType: 'PERCENTAGE',
    discountValue: D(5),
    reservationAmountType: 'PERCENTAGE',
    reservationAmountValue: D(2),
    downPaymentType: 'PERCENTAGE',
    downPaymentValue: D(10),
    frequency: 'MONTHLY',
    startDateRule: 'AFTER_CONTRACT',
    manualStartDate: null,
    validFrom: null,
    validTo: null,
    totalPrice: D(0),
    netPrice: D(0),
    reservationAmount: D(0),
    downPaymentAmount: D(0),
    finalPaymentAmount: null,
    durationOptions: [{ id: 'o1', durationMonths: 84, increasePercentage: D(0), order: 0 }],
    scheduleItems: [],
    ...opts.existing,
  };
  const prisma = {
    project: { findFirst: jest.fn().mockResolvedValue({ id: PROJECT }) },
    unitType: {
      findMany: jest.fn().mockImplementation(async ({ where }: { where: { code?: { in: string[] } } }) =>
        where.code
          ? where.code.in.filter((c) => (opts.unitTypes ?? ['2BR', 'Office']).includes(c)).map((code) => ({ code }))
          : [{ code: '2BR', name: { ar: 'غرفتين', en: '2BR' } }, { code: '1BR', name: { ar: 'غرفة', en: '1BR' } }],
      ),
    },
    setting: { findFirst: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    reservation: { count: jest.fn().mockResolvedValue(0) },
    unit: {
      count: jest.fn().mockResolvedValue(12),
      findMany: jest.fn().mockResolvedValue([
        { id: 'u1', code: 'A1-101', type: '2BR', price: D(3_600_000) },
        { id: 'u2', code: 'B1-201', type: '1BR', price: D(2_400_000) },
      ]),
      groupBy: jest.fn().mockResolvedValue([
        { type: '1BR', _count: { _all: 5 } },
        { type: '2BR', _count: { _all: 7 } },
      ]),
    },
    installmentPlanTemplate: {
      findUnique: jest.fn().mockResolvedValue(stored),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: 'plan-new' };
      }),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    installmentPlanDurationOption: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
  const svc = new PlanTemplatesService(prisma as never, { sendToRoles: jest.fn() } as never);
  return { svc, prisma, created };
}

const base = {
  name: 'تقسيط 7 سنوات – مقدم 10%',
  projectId: PROJECT,
  discountType: 'PERCENTAGE' as const,
  discountValue: 5,
  reservationAmountType: 'PERCENTAGE' as const,
  reservationAmountValue: 2,
  downPaymentType: 'PERCENTAGE' as const,
  downPaymentValue: 10,
  startDateRule: 'AFTER_CONTRACT' as const,
  durationOptions: [{ durationMonths: 84, increasePercentage: 0 }],
};

describe('PlanTemplatesService.create — a project plan (no unit)', () => {
  it('stores the percentages, no unit, and 0 for every raw amount', async () => {
    const { svc, created } = make();
    await svc.create(base as never, 'admin-1');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ unitId: null, percentPriced: true, unitTypes: [] });
    expect(String(created[0]!.totalPrice)).toBe('0');
    expect(String(created[0]!.netPrice)).toBe('0');
    expect(String(created[0]!.discountValue)).toBe('5');
    expect(String(created[0]!.downPaymentValue)).toBe('10');
  });

  it('a unit-type plan keeps its codes and its validity dates', async () => {
    const { svc, created } = make();
    await svc.create({ ...base, unitTypes: ['2BR', '2BR'], validFrom: '2026-11-01', validTo: '2026-12-31' } as never, 'admin-1');
    expect(created[0]!.unitTypes).toEqual(['2BR']);
    expect((created[0]!.validFrom as Date).toISOString().slice(0, 10)).toBe('2026-11-01');
    expect((created[0]!.validTo as Date).toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('refuses what cannot fit units of different prices', async () => {
    const { svc, created } = make();
    await expect(svc.create({ ...base, discountType: 'FIXED' } as never, 'a')).rejects.toThrow(/نسبة مئوية/);
    await expect(svc.create({ ...base, downPaymentType: 'FIXED' } as never, 'a')).rejects.toThrow(/المقدم/);
    await expect(svc.create({ ...base, finalPaymentAmount: 5000 } as never, 'a')).rejects.toThrow(/الدفعة الأخيرة/);
    await expect(svc.create({ ...base, durationOptions: [] } as never, 'a')).rejects.toThrow(/خيار مدة/);
    expect(created).toHaveLength(0);
  });

  it('refuses an unknown unit type, a bad date range, and a unit-less plan for another company\'s project', async () => {
    const { svc, prisma } = make();
    await expect(svc.create({ ...base, unitTypes: ['Spaceship'] } as never, 'a')).rejects.toThrow(/نوع وحدة غير معروف/);
    await expect(svc.create({ ...base, validFrom: '2026-12-31', validTo: '2026-11-01' } as never, 'a')).rejects.toThrow(/قبل/);
    prisma.project.findFirst.mockResolvedValueOnce(null);
    await expect(svc.create(base as never, 'a')).rejects.toThrow(BadRequestException);
  });

  it('a cash project plan needs no down payment or durations', async () => {
    const { svc, created } = make();
    await svc.create({ ...base, isCash: true, downPaymentType: undefined, downPaymentValue: undefined, durationOptions: undefined } as never, 'a');
    expect(created[0]).toMatchObject({ isCash: true, unitId: null });
  });

  it('unit types belong to a project plan: a unit plan with types is refused', async () => {
    const { svc } = make();
    await expect(
      svc.create({ ...base, unitId: '22222222-2222-4222-8222-222222222222', totalPrice: 1_000_000, unitTypes: ['2BR'] } as never, 'a'),
    ).rejects.toThrow(/خطة المشروع فقط/);
  });
});

describe('PlanTemplatesService.findOne — for the edit screen', () => {
  it('says how many units a project plan covers and how many reservations use it', async () => {
    const { svc, prisma } = make();
    prisma.reservation.count.mockResolvedValueOnce(2).mockResolvedValueOnce(9);
    const plan = await svc.findOne('plan-new');
    expect(plan).toMatchObject({ scope: 'PROJECT', unitsInScope: 12, reservationsInUse: 2, reservationsTotal: 9 });
  });
});

describe('PlanTemplatesService.list — what clients read', () => {
  it('gives every plan its scope, and a project plan its amounts on a price of 100', async () => {
    const { svc, prisma } = make();
    const unitPlan = { id: 'u', unitId: 'unit-1', unitTypes: [], isCash: false };
    const projectPlan = {
      id: 'p', unitId: null, percentPriced: true, unitTypes: [], isCash: false,
      totalPrice: D(0), discountAmount: D(0), discountType: 'PERCENTAGE', discountValue: D(5), netPrice: D(0),
      reservationAmount: D(0), reservationAmountType: 'PERCENTAGE', reservationAmountValue: D(2),
      downPaymentType: 'PERCENTAGE', downPaymentValue: D(10), downPaymentAmount: D(0), finalPaymentAmount: null,
    };
    prisma.installmentPlanTemplate.findMany.mockResolvedValueOnce([unitPlan, projectPlan]);
    prisma.installmentPlanTemplate.count.mockResolvedValueOnce(2);
    const out = await svc.list({ page: 1, pageSize: 20, role: 'ADMIN' as never });
    expect(out.data[0]).toMatchObject({ id: 'u', scope: 'UNIT' });
    expect('sample' in out.data[0]!).toBe(false);
    expect(out.data[1]).toMatchObject({ id: 'p', scope: 'PROJECT' });
    expect((out.data[1] as { sample: { netPrice: number; reservationAmount: number; downPaymentAmount: number } }).sample).toMatchObject({
      netPrice: 95,
      reservationAmount: 2,
      downPaymentAmount: 9.5,
    });
  });
});

describe('PlanTemplatesService — the project plan screen helpers', () => {
  it('previews the plan on real units, with the same numbers a reservation will get', async () => {
    const { svc, prisma } = make();
    prisma.installmentPlanTemplate.findMany.mockResolvedValueOnce([{ unitId: 'u2' }]);
    const out = await svc.previewScoped({
      projectId: PROJECT,
      discountType: 'PERCENTAGE',
      discountValue: 5,
      reservationAmountType: 'PERCENTAGE',
      reservationAmountValue: 2,
      downPaymentType: 'PERCENTAGE',
      downPaymentValue: 10,
      durationOptions: [{ durationMonths: 84, increasePercentage: 0 }],
    } as never);
    expect(out.problem).toBeNull();
    const a = out.rows.find((r) => r.code === 'A1-101')!;
    expect(a).toMatchObject({ netPrice: 3_420_000, reservationAmount: 72_000, downPaymentAmount: 342_000, ownPlan: false });
    // 3,420,000 − 72,000 − 342,000 = 3,006,000 over 84 months
    expect(a.options[0]).toMatchObject({ durationMonths: 84, monthly: 35_785.71, total: 3_420_000 });
    expect(out.rows.find((r) => r.code === 'B1-201')!.ownPlan).toBe(true); // takes its own plan
  });

  it('says what is wrong instead of previewing nonsense', async () => {
    const { svc } = make();
    const out = await svc.previewScoped({ projectId: PROJECT, discountType: 'FIXED', discountValue: 5 } as never);
    expect(out.problem).toMatch(/نسبة مئوية/);
    expect(out.rows).toEqual([]);
  });

  it("lists the project's unit types with their unit counts, biggest first", async () => {
    const { svc } = make();
    const out = await svc.scopeInfo(PROJECT);
    expect(out.totalUnits).toBe(12);
    expect(out.unitTypes.map((t) => [t.code, t.units])).toEqual([['2BR', 7], ['1BR', 5]]);
  });
});
