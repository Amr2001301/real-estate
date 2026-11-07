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
      findMany: jest.fn().mockImplementation(async ({ where }: { where: { code: { in: string[] } } }) =>
        where.code.in.filter((c) => (opts.unitTypes ?? ['2BR', 'Office']).includes(c)).map((code) => ({ code })),
      ),
    },
    setting: { findFirst: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    reservation: { count: jest.fn().mockResolvedValue(0) },
    unit: { count: jest.fn().mockResolvedValue(12) },
    installmentPlanTemplate: {
      findUnique: jest.fn().mockResolvedValue(stored),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: 'plan-new' };
      }),
      update: jest.fn().mockResolvedValue({}),
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
    expect(created[0]).toMatchObject({ unitId: null, unitTypes: [] });
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
