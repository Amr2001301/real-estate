/**
 * Y4 — clawbacks owed. A deal cancelled after its broker commission and the
 * rep's bonus were paid leaves both owed back to the company, and that was on
 * no report: the financial dashboard's liabilities only showed them as paid.
 * They now have their own line: what each clawback recovers less what was
 * collected, outside the total the company owes.
 */
import 'reflect-metadata';
import request from 'supertest';
import { BonusEntryStatus, BrokerCommissionStatus, ClawbackStatus, Prisma } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Y4 — clawbacks owed are on the financial dashboard (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let contractId = '';
  let commissionId = '';
  let bonusId = '';
  const stamp = Date.now().toString().slice(-7);
  // A month of its own, so the dashboard's date filter isolates these rows.
  const clawedAt = new Date('2004-05-12T10:00:00Z');

  const dashboard = async () =>
    (
      await request(testApp.app.getHttpServer())
        .get('/v1/reports/financial-dashboard?dateFrom=2004-05-01&dateTo=2004-05-31')
        .set('Authorization', bearer(adminToken))
        .expect(200)
    ).body.liabilities;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    const companyId = (
      await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
    const unit = await raw.unit.findFirstOrThrow({
      where: { companyId },
      select: { id: true, building: { select: { phase: { select: { projectId: true } } } } },
    });
    const broker = await raw.broker.findFirstOrThrow({
      where: { companyId },
      select: { id: true },
    });
    const rule = await raw.bonusRule.findFirstOrThrow({
      where: { companyId },
      select: { id: true },
    });

    contractId = (
      await raw.contract.create({
        data: {
          companyId,
          customerId: fixtures.userIds.customer1UserId,
          unitId: unit.id,
          totalAmount: 1_000_000,
          signedAt: clawedAt,
          status: 'CANCELLED',
        },
        select: { id: true },
      })
    ).id;
    // Paid 25,000, clawed back on the cancellation; 10,000 recovered so far.
    commissionId = (
      await raw.brokerCommission.create({
        data: {
          companyId,
          commissionNumber: `Y4-BC-${stamp}`,
          brokerId: broker.id,
          contractId,
          unitId: unit.id,
          projectId: unit.building.phase.projectId,
          basisAmount: 1_000_000,
          grossAmount: 25_000,
          netAmount: 25_000,
          earnedAt: clawedAt,
          status: BrokerCommissionStatus.APPROVED,
          clawbackStatus: ClawbackStatus.PARTIALLY_COLLECTED,
          clawbackAmount: new Prisma.Decimal(25_000),
          clawbackCollectedAmount: new Prisma.Decimal(10_000),
          clawbackAt: clawedAt,
        },
        select: { id: true },
      })
    ).id;
    // A paid bonus of 8,000, clawed back, nothing recovered.
    bonusId = (
      await raw.bonusEntry.create({
        data: {
          companyId,
          salesId: fixtures.userIds.salesId,
          ruleId: rule.id,
          contractId,
          amount: 8_000,
          period: '2004-05',
          status: BonusEntryStatus.PAID,
          clawbackStatus: ClawbackStatus.OUTSTANDING,
          clawbackAmount: new Prisma.Decimal(8_000),
          clawbackAt: clawedAt,
          createdAt: clawedAt,
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    if (bonusId) await raw.bonusEntry.deleteMany({ where: { id: bonusId } });
    if (commissionId) await raw.brokerCommission.deleteMany({ where: { id: commissionId } });
    if (contractId) await raw.contract.deleteMany({ where: { id: contractId } });
  });

  it('Y4-1: what is still owed back shows — each clawback less what was collected', async () => {
    const before = await dashboard();
    expect(before.clawbacksOwed).toEqual({
      brokerCommissionsAmount: '15000',
      brokerCommissionsCount: 1,
      salesBonusAmount: '8000',
      salesBonusCount: 1,
      totalAmount: '23000',
    });
  });

  it('Y4-2: a clawback collected in full or waived is no longer owed', async () => {
    await testApp.rawPrisma.brokerCommission.update({
      where: { id: commissionId },
      data: { clawbackStatus: ClawbackStatus.COLLECTED, clawbackCollectedAmount: 25_000 },
    });
    await testApp.rawPrisma.bonusEntry.update({
      where: { id: bonusId },
      data: { clawbackStatus: ClawbackStatus.WAIVED },
    });
    expect((await dashboard()).clawbacksOwed.totalAmount).toBe('0');
  });
});
