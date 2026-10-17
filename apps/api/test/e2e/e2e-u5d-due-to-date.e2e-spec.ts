/**
 * U5d — the dashboard's collection rate is measured against what has fallen
 * due by today, not against the whole contract value (most of which is not
 * due yet, so a healthy company showed a red "low — action needed").
 *
 * `financial.dueToDate` on /reports/admin-summary = booking amounts of live
 * contracts + their payment rows due up to today. Rows due later, cancelled
 * rows and late fees are left out.
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

describe('U5d — collection rate against what is due (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let customerId: string;
  let unit: { id: string; status: UnitStatus };
  let reservationId: string;
  let contractId: string;
  const stamp = Date.now().toString().slice(-8);

  const dueToDate = async () =>
    Number(
      (
        await request(testApp.app.getHttpServer())
          .get('/v1/reports/admin-summary')
          .set('Authorization', bearer(adminToken))
          .expect(200)
      ).body.financial.dueToDate,
    );

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    customerId = (
      await raw.user.create({
        data: { companyId, role: UserRole.CUSTOMER, fullName: 'U5d Customer', phone: `+2024${stamp}`, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    unit = await raw.unit.findFirstOrThrow({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
    });
    await raw.unit.update({ where: { id: unit.id }, data: { status: UnitStatus.SOLD } });
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.deposit.deleteMany({ where: { contractId } });
    await raw.installment.deleteMany({ where: { plan: { contractId } } });
    await raw.installmentPlan.deleteMany({ where: { contractId } });
    await raw.contract.deleteMany({ where: { id: contractId } });
    await raw.reservation.deleteMany({ where: { id: reservationId } });
    await raw.unit.update({ where: { id: unit.id }, data: { status: unit.status } });
    await raw.user.deleteMany({ where: { id: customerId } });
  });

  it('D-1: booking + rows due by today count; later, cancelled and fee rows do not', async () => {
    const raw = testApp.rawPrisma;
    const before = await dueToDate();

    reservationId = (
      await raw.reservation.create({
        data: {
          companyId,
          unitId: unit.id,
          salesId: fixtures.userIds.adminId,
          clientId: customerId,
          status: ReservationStatus.CONVERTED,
          bookingAmount: 20_000,
          expiresAt: new Date(Date.now() + DAY),
        },
        select: { id: true },
      })
    ).id;
    contractId = (
      await raw.contract.create({
        data: {
          companyId, customerId, unitId: unit.id, reservationId, totalAmount: 1_000_000,
          status: ContractStatus.ACTIVE, signedAt: new Date(), contractNumber: `U5D-${stamp}`,
        },
        select: { id: true },
      })
    ).id;
    const plan = await raw.installmentPlan.create({
      data: { companyId, contractId, totalMonths: 4, monthlyAmount: 100_000, startsAt: new Date() },
      select: { id: true },
    });
    const row = (type: PlanPaymentType, amount: number, days: number, status: InstallmentStatus) =>
      raw.installment.create({
        data: {
          companyId, planId: plan.id, type, amount, status,
          dueDate: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) + days * DAY),
          ...(status === InstallmentStatus.PAID ? { paidAt: new Date() } : {}),
        },
      });
    await row(PlanPaymentType.DOWN_PAYMENT, 100_000, -40, InstallmentStatus.PAID); // due → counts
    await row(PlanPaymentType.INSTALLMENT, 50_000, -5, InstallmentStatus.OVERDUE); // due → counts
    await row(PlanPaymentType.INSTALLMENT, 200_000, 30, InstallmentStatus.PENDING); // later → out
    await row(PlanPaymentType.INSTALLMENT, 30_000, -10, InstallmentStatus.CANCELLED); // cancelled → out
    await row(PlanPaymentType.LATE_FEE, 5_000, -3, InstallmentStatus.PENDING); // a fee → out

    expect((await dueToDate()) - before).toBe(170_000);
  });

  it('D-3: a payment in the activity feed carries its amount', async () => {
    const deposit = await testApp.rawPrisma.deposit.create({
      data: {
        companyId, contractId, type: DepositType.INSTALLMENT, amount: 12_345, paidAt: new Date(),
        recordedById: fixtures.userIds.adminId,
      },
      select: { id: true },
    });
    const body = (
      await request(testApp.app.getHttpServer())
        .get('/v1/reports/admin-summary')
        .set('Authorization', bearer(adminToken))
        .expect(200)
    ).body as { recentActivity: Array<{ id: string; amount?: number }> };
    expect(body.recentActivity.find((a) => a.id === `deposit:${deposit.id}`)?.amount).toBe(12_345);
  });

  it('D-2: a cancelled contract drops out', async () => {
    const before = await dueToDate();
    await testApp.rawPrisma.contract.update({ where: { id: contractId }, data: { status: ContractStatus.CANCELLED } });
    expect(before - (await dueToDate())).toBe(170_000);
  });
});
