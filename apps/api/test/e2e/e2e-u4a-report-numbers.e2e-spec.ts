/**
 * U4a — report numbers that were wrong.
 *
 * - The broker leaderboard joined "User" on the broker id (a Broker): always empty.
 * - A date-only "to" dropped its own day (lte midnight at its start).
 * - Sales performance counted cancelled contracts as sales.
 * - The dashboard's 30-day forecast left out rows due today.
 * - A batch payment's receipt was linked to its first deposit only.
 * - Net collected, filtered by a payment type, took off every refund.
 */
import 'reflect-metadata';
import request from 'supertest';
import {
  BrokerCommissionStatus,
  ContractStatus,
  DepositType,
  DocumentOwnerType,
  InstallmentStatus,
  PlanPaymentType,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const cairoToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

describe('U4a — report numbers (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let customerId: string;
  let units: Array<{ id: string; status: UnitStatus }>;
  let contractId: string;
  let planId: string;
  const created = { commissions: [] as string[], contracts: [] as string[], reservations: [] as string[] };
  const stamp = Date.now().toString().slice(-8);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    customerId = (
      await raw.user.create({
        data: { companyId, role: UserRole.CUSTOMER, fullName: 'U4a Customer', phone: `+2020${stamp}`, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    units = await raw.unit.findMany({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
      take: 2,
    });
    expect(units).toHaveLength(2);
    await raw.unit.updateMany({ where: { id: { in: units.map((u) => u.id) } }, data: { status: UnitStatus.SOLD } });
    contractId = (
      await raw.contract.create({
        data: {
          companyId, customerId, unitId: units[0]!.id, totalAmount: 100_000, status: ContractStatus.ACTIVE,
          signedAt: new Date(), contractNumber: `U4A-${stamp}`,
        },
        select: { id: true },
      })
    ).id;
    created.contracts.push(contractId);
    planId = (
      await raw.installmentPlan.create({
        data: { companyId, contractId, totalMonths: 2, monthlyAmount: 1000, startsAt: new Date() },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.document.deleteMany({ where: { ownerType: DocumentOwnerType.DEPOSIT, ownerId: { in: (await raw.deposit.findMany({ where: { contractId }, select: { id: true } })).map((d) => d.id) } } });
    await raw.deposit.deleteMany({ where: { contractId } });
    await raw.installment.deleteMany({ where: { planId } });
    await raw.installmentPlan.deleteMany({ where: { id: planId } });
    await raw.brokerCommission.deleteMany({ where: { id: { in: created.commissions } } });
    await raw.refund.deleteMany({ where: { cancellation: { contractId: { in: created.contracts } } } });
    await raw.contractCancellation.deleteMany({ where: { contractId: { in: created.contracts } } });
    await raw.contract.deleteMany({ where: { id: { in: created.contracts } } });
    await raw.reservation.deleteMany({ where: { id: { in: created.reservations } } });
    for (const u of units) await raw.unit.update({ where: { id: u.id }, data: { status: u.status } });
    await raw.auditLog.deleteMany({ where: { entityId: contractId, createdAt: { gte: startedAt } } });
    await raw.notification.deleteMany({ where: { userId: customerId } });
    await raw.user.deleteMany({ where: { id: customerId } });
  });

  it('N-1: the broker leaderboard lists brokers with approved commissions', async () => {
    const broker = await testApp.rawPrisma.broker.findFirstOrThrow({ where: { code: fixtures.brokerCodes.BROKER_1 }, select: { id: true } });
    const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({
      where: { id: units[0]!.id },
      select: { building: { select: { phase: { select: { projectId: true } } } } },
    });
    created.commissions.push(
      (
        await testApp.rawPrisma.brokerCommission.create({
          data: {
            companyId, commissionNumber: `BC-U4A-${stamp}`, brokerId: broker.id, contractId, unitId: units[0]!.id,
            projectId: unit.building.phase.projectId, basisAmount: 100_000, commissionPct: 2, grossAmount: 2000,
            netAmount: 2000, earnedAt: new Date(), status: BrokerCommissionStatus.APPROVED,
          },
          select: { id: true },
        })
      ).id,
    );
    const res = await asAdmin(http().get('/v1/reports/broker-leaderboard')).expect(200);
    const row = (res.body as Array<{ brokerId: string; commissionAmount: number }>).find((r) => r.brokerId === broker.id);
    expect(row).toBeDefined();
    expect(row!.commissionAmount).toBeGreaterThanOrEqual(2000);
  });

  it('N-2: a date-only "to" covers its whole day', async () => {
    const today = cairoToday();
    const count = async () =>
      (await asAdmin(http().get('/v1/reports/financial').query({ dateFrom: today, dateTo: today })).expect(200)).body
        .deposits as number;
    const before = await count();
    await testApp.rawPrisma.deposit.create({
      data: { companyId, contractId, type: DepositType.DOWN_PAYMENT, amount: 500, paidAt: new Date(), recordedById: fixtures.userIds.adminId },
    });
    expect(await count()).toBe(before + 1);
  });

  it('N-3: sales performance does not count a cancelled contract as a sale', async () => {
    const raw = testApp.rawPrisma;
    const period = new Date().toISOString().slice(0, 7);
    const signed = async () => {
      const res = await asAdmin(http().get('/v1/sales-targets/performance').query({ period })).expect(200);
      const rows = (Array.isArray(res.body) ? res.body : res.body.data) as Array<{ salesId: string; signedContractsCount: number }>;
      return rows.find((r) => r.salesId === fixtures.userIds.salesId)?.signedContractsCount ?? 0;
    };
    const before = await signed();
    const reservation = await raw.reservation.create({
      data: {
        companyId, unitId: units[1]!.id, salesId: fixtures.userIds.salesId, clientId: customerId,
        status: ReservationStatus.CONVERTED, expiresAt: new Date(), reservationNumber: `U4A-${stamp}`,
      },
      select: { id: true },
    });
    created.reservations.push(reservation.id);
    const cancelled = await raw.contract.create({
      data: {
        companyId, customerId, unitId: units[1]!.id, reservationId: reservation.id, totalAmount: 50_000,
        status: ContractStatus.CANCELLED, signedAt: new Date(), contractNumber: `U4A-X-${stamp}`,
      },
      select: { id: true },
    });
    created.contracts.push(cancelled.id);
    expect(await signed()).toBe(before);
  });

  it('N-4: the 30-day forecast includes rows due today', async () => {
    const forecast = async () =>
      (await asAdmin(http().get('/v1/reports/admin-summary')).expect(200)).body.cashflowForecast.next30 as number;
    const before = await forecast();
    await testApp.rawPrisma.installment.create({
      data: {
        companyId, planId, amount: 777, status: InstallmentStatus.PENDING, type: PlanPaymentType.INSTALLMENT,
        dueDate: new Date(`${cairoToday()}T00:00:00Z`),
      },
    });
    expect(await forecast()).toBeCloseTo(before + 777, 2);
  });

  it('N-5: a batch payment’s receipt belongs to every deposit it covers', async () => {
    const raw = testApp.rawPrisma;
    const rows = await Promise.all(
      [10, 40].map((days) =>
        raw.installment.create({
          data: {
            companyId, planId, amount: 1000, status: InstallmentStatus.PENDING, type: PlanPaymentType.INSTALLMENT,
            dueDate: new Date(Date.now() + days * 86_400_000),
          },
          select: { id: true },
        }),
      ),
    );
    const res = await asAdmin(http().post('/v1/deposits/batch'))
      .send({
        contractId,
        installmentIds: rows.map((r) => r.id),
        paymentMethod: 'CASH',
        receiptUrl: `receipts/2026-10-17/${crypto.randomUUID()}.pdf`,
      })
      .expect(201);
    const depositIds = ((res.body.deposits ?? res.body) as Array<{ id: string }>).map((d) => d.id);
    expect(depositIds).toHaveLength(2);
    for (const id of depositIds) {
      expect(await raw.document.count({ where: { ownerType: DocumentOwnerType.DEPOSIT, ownerId: id } })).toBe(1);
    }
  });

  it('N-6: net collected, filtered by a payment type, takes off no refund', async () => {
    const raw = testApp.rawPrisma;
    const cancelledId = created.contracts[1]!;
    const cancellation = await raw.contractCancellation.create({
      data: {
        companyId, contractId: cancelledId, cancelledById: fixtures.userIds.adminId, reason: 'U4a',
        cancellationDate: new Date(), totalCollectedSnapshot: 1000, retainedAmount: 0, refundAmount: 300, policySnapshot: {},
      },
      select: { id: true },
    });
    await raw.refund.create({
      data: {
        companyId, contractCancellationId: cancellation.id, amount: 300, paymentMethod: 'CASH', paidAt: new Date(),
        recordedById: fixtures.userIds.adminId,
      },
    });
    const res = await asAdmin(http().get('/v1/reports/financial-dashboard').query({ type: DepositType.DOWN_PAYMENT })).expect(200);
    expect(Number(res.body.summary.netCollected)).toBe(Number(res.body.summary.totalCollectedVerified));
  });
});
