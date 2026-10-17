/**
 * V3 — one definition per report figure (numbers audit, owner's decisions of
 * 2026-10-17).
 *
 * - a. Sales and contract value are the net price (without the instalment
 *   markup); b. contract value counts signed contracts only.
 * - c. The collection rate is collected against what is due by today: a
 *   payment ahead of its due date is not counted.
 * - "Collected" on the reports page is towards the price, fees a figure of
 *   their own; overdue leaves fee rows out; deleted reservations don't count.
 */
import 'reflect-metadata';
import request from 'supertest';
import {
  ContractStatus,
  DepositType,
  InstallmentStatus,
  PlanPaymentType,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const DAY = 86_400_000;

describe('V3 — report figures (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let customerId: string;
  let units: Array<{ id: string; status: UnitStatus }> = [];
  const reservationIds: string[] = [];
  const contractIds: string[] = [];
  const stamp = Date.now().toString().slice(-8);
  const todayUtc = () => {
    const n = new Date();
    return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  };
  // Today in the company's time zone (the reports filter by its days).
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

  const get = async <T>(path: string): Promise<T> =>
    (await request(testApp.app.getHttpServer()).get(path).set('Authorization', bearer(adminToken)).expect(200)).body as T;
  type Fin = { totalContractValue: number; dueToDate: number; collectedAgainstDue: number; collectedTowardsPrice: number };
  const summary = async () => (await get<{ financial: Fin }>('/v1/reports/admin-summary')).financial;
  const fin = async () =>
    (await get<{ summary: Record<string, string> }>('/v1/reports/financial-dashboard')).summary;

  /** A contract on its own unit, with a reservation carrying the markup snapshot. */
  const contract = async (n: number, opts: { total: number; financed?: number; remaining?: number; signed: boolean }) => {
    const raw = testApp.rawPrisma;
    const unit = units[n]!;
    const reservationId = (
      await raw.reservation.create({
        data: {
          companyId, unitId: unit.id, salesId: fixtures.userIds.adminId, clientId: customerId,
          status: ReservationStatus.CONVERTED, bookingAmount: 0, expiresAt: new Date(Date.now() + DAY),
          snapshotFinancedAmount: opts.financed ?? null, snapshotRemainingAmount: opts.remaining ?? null,
        },
        select: { id: true },
      })
    ).id;
    reservationIds.push(reservationId);
    const id = (
      await raw.contract.create({
        data: {
          companyId, customerId, unitId: unit.id, reservationId, totalAmount: opts.total,
          status: opts.signed ? ContractStatus.ACTIVE : ContractStatus.UNSIGNED,
          signedAt: opts.signed ? new Date() : null, contractNumber: `V3-${stamp}-${n}`,
        },
        select: { id: true },
      })
    ).id;
    contractIds.push(id);
    return id;
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    customerId = (
      await raw.user.create({
        data: { companyId, role: UserRole.CUSTOMER, fullName: 'V3 Customer', phone: `+2026${stamp}`, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    units = await raw.unit.findMany({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      take: 3,
      select: { id: true, status: true },
    });
    if (units.length < 3) throw new Error('V3 needs 3 free units');
    await raw.unit.updateMany({ where: { id: { in: units.map((u) => u.id) } }, data: { status: UnitStatus.SOLD } });
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.deposit.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.installment.deleteMany({ where: { plan: { contractId: { in: contractIds } }, feeForId: { not: null } } });
    await raw.installment.deleteMany({ where: { plan: { contractId: { in: contractIds } } } });
    await raw.installmentPlan.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    await raw.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    for (const u of units) await raw.unit.update({ where: { id: u.id }, data: { status: u.status } });
    await raw.user.deleteMany({ where: { id: customerId } });
  });

  it('V3-1: contract value and sales are signed contracts at their net price', async () => {
    const before = await summary();
    const salesBefore = await get<{ total: number }>(`/v1/reports/sales?dateFrom=${day}&dateTo=${day}`);
    // 1,000,000 price + 10,000 markup (financed 110,000 for 100,000 remaining).
    await contract(0, { total: 1_010_000, financed: 110_000, remaining: 100_000, signed: true });
    // Converted, not signed yet: no contract value.
    await contract(1, { total: 500_000, signed: false });

    const after = await summary();
    expect(Math.round(after.totalContractValue - before.totalContractValue)).toBe(1_000_000);
    const salesAfter = await get<{ total: number }>(`/v1/reports/sales?dateFrom=${day}&dateTo=${day}`);
    expect(Math.round(Number(salesAfter.total) - Number(salesBefore.total))).toBe(1_000_000);
  });

  it('V3-2: the collection rate counts what is collected against what is due — not early payments; overdue leaves fees out', async () => {
    const raw = testApp.rawPrisma;
    const contractId = await contract(2, { total: 300_000, signed: true });
    const plan = await raw.installmentPlan.create({
      data: { companyId, contractId, totalMonths: 3, monthlyAmount: 100_000, startsAt: new Date() },
      select: { id: true },
    });
    const row = (type: PlanPaymentType, amount: number, days: number, status: InstallmentStatus) =>
      raw.installment.create({
        data: {
          companyId, planId: plan.id, type, amount, status,
          dueDate: new Date(todayUtc() + days * DAY),
          ...(status === InstallmentStatus.PAID ? { paidAt: new Date() } : {}),
        },
        select: { id: true },
      });
    const before = await summary();
    const finBefore = await fin();

    await row(PlanPaymentType.INSTALLMENT, 100_000, -10, InstallmentStatus.OVERDUE); // due, unpaid
    const early = await row(PlanPaymentType.INSTALLMENT, 100_000, 30, InstallmentStatus.PAID); // paid ahead
    await raw.deposit.create({
      data: {
        companyId, contractId, installmentId: early.id, type: DepositType.INSTALLMENT, amount: 100_000,
        paidAt: new Date(), recordedById: fixtures.userIds.adminId,
      },
    });
    await row(PlanPaymentType.LATE_FEE, 5_000, -3, InstallmentStatus.OVERDUE); // a fee, overdue

    const after = await summary();
    expect(Math.round(after.dueToDate - before.dueToDate)).toBe(100_000);
    expect(Math.round(after.collectedTowardsPrice - before.collectedTowardsPrice)).toBe(100_000);
    // Nothing collected against what is due: 100,000 due, 0 paid of it.
    expect(Math.round(after.collectedAgainstDue - before.collectedAgainstDue)).toBe(0);

    const finAfter = await fin();
    expect(Math.round(Number(finAfter.collectedAgainstDue) - Number(finBefore.collectedAgainstDue))).toBe(0);
    expect(Math.round(Number(finAfter.dueToDate) - Number(finBefore.dueToDate))).toBe(100_000);
    // Overdue is towards the price: the 5,000 fee is not in it.
    expect(Math.round(Number(finAfter.totalOverdue) - Number(finBefore.totalOverdue))).toBe(100_000);
  });

  it('V3-3: the reports page\'s "collected" is towards the price; fees are their own figure', async () => {
    const before = await get<{ total: number; fees: number }>(`/v1/reports/financial?dateFrom=${day}&dateTo=${day}`);
    await testApp.rawPrisma.deposit.create({
      data: {
        companyId, contractId: contractIds[0]!, type: DepositType.FEE, amount: 7_000,
        paidAt: new Date(), recordedById: fixtures.userIds.adminId,
      },
    });
    const after = await get<{ total: number; fees: number }>(`/v1/reports/financial?dateFrom=${day}&dateTo=${day}`);
    expect(Math.round(Number(after.total) - Number(before.total))).toBe(0);
    expect(Math.round(Number(after.fees ?? 0) - Number(before.fees ?? 0))).toBe(7_000);
  });

  it('V3-4: a deleted reservation is not counted', async () => {
    const raw = testApp.rawPrisma;
    const count = async () => {
      const r = await get<Record<string, number>>(`/v1/reports/reservations?dateFrom=${day}&dateTo=${day}`);
      return Object.values(r).reduce((a, b) => a + Number(b), 0);
    };
    const before = await count();
    const id = (
      await raw.reservation.create({
        data: {
          companyId, unitId: units[1]!.id, salesId: fixtures.userIds.adminId, clientId: customerId,
          status: ReservationStatus.CANCELLED, bookingAmount: 0, expiresAt: new Date(Date.now() + DAY), deletedAt: new Date(),
        },
        select: { id: true },
      })
    ).id;
    reservationIds.push(id);
    expect(await count()).toBe(before);
  });
});
