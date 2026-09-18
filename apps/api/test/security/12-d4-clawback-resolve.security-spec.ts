/**
 * Step D4 — clawback:collect + clawback:waive security and e2e tests.
 *
 * All tests use real Postgres (TEST_DATABASE_URL). Rows are read back from the
 * database after each operation. No test returns early on a missing precondition —
 * missing rows throw so the failure is visible.
 *
 * Test matrix:
 *   D4-1   Commission OUTSTANDING → COLLECTED (full amount):
 *            clawbackStatus=COLLECTED, amount/reference/method stored,
 *            commission.status=APPROVED unchanged (Hard Rule 2)
 *   D4-2   Commission partial repayment: OUTSTANDING → PARTIALLY_COLLECTED (NOT COLLECTED)
 *   D4-3   Commission second collect: PARTIALLY_COLLECTED + second amount → COLLECTED
 *   D4-4   Commission OUTSTANDING → WAIVED: clawbackWaiveReason stored separately from clawbackReason
 *   D4-5   COLLECTED commission → 409 on second collect
 *   D4-6   WAIVED commission → 409 on second waive
 *   D4-7   clawbackStatus null → 409 (no clawback to resolve)
 *   D4-8   commission.status unchanged across all paths (final assertion)
 *   D4-9   BonusEntry OUTSTANDING → COLLECTED: bonusEntry.status=PAID unchanged
 *   D4-10  BonusEntry OUTSTANDING → WAIVED: waiveReason vs clawbackReason are distinct
 *   D4-11  Cross-tenant: Company A admin → Company B commission → 404
 *   D4-12  Cross-tenant: Company A admin → Company B bonusEntry → 404
 *   D4-13  Atomicity (commission collect): force DB error; nothing changes
 *   D4-14  Atomicity (bonus waive): force DB error; nothing changes
 */

import request from 'supertest';
import {
  BonusEntryStatus,
  BrokerCommissionStatus,
  BrokerStatus,
  ClawbackStatus,
  ContractStatus,
  PaymentMethod,
} from '@prisma/client';
import { type TestApp, createTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  SEC_SLUG_B,
  type SecurityFixture,
} from './seed/security-fixture';

let testApp: TestApp;
let fx: SecurityFixture;
let adminAToken: string;
let adminBToken: string;

const NET_AMOUNT = 75_000;
const BONUS_AMOUNT = 20_000;

let unitCounter = 0;

describe('SEC — D4: clawback:collect + clawback:waive (Step D4)', () => {
  beforeAll(async () => {
    testApp = await createTestApp();
    fx = await seedSecurityFixture(testApp.rawPrisma);
    adminAToken = await loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password);
    adminBToken = await loginAs(testApp.app, fx.users.adminB.email, fx.users.adminB.password);

    // Grant both clawback:resolve permissions to adminA
    for (const code of ['broker-commissions:clawback:resolve', 'bonus:clawback:resolve']) {
      const perm = await testApp.rawPrisma.permission.findFirst({ where: { code } });
      if (perm) {
        await testApp.rawPrisma.userPermission.upsert({
          where: { userId_permissionId: { userId: fx.users.adminA.id, permissionId: perm.id } },
          create: { userId: fx.users.adminA.id, permissionId: perm.id },
          update: {},
        });
      }
    }
  }, 90_000);

  afterAll(async () => {
    // D4-11 creates Company B broker commissions that reference Company A's project
    // (cross-company FK). Fixture teardown deletes Company A first, so those FKs
    // would block deletion of Company A's project. Delete them before teardown.
    await testApp.rawPrisma.brokerCommission.deleteMany({
      where: { commissionNumber: { startsWith: 'D4-XTEN-' } },
    });
    // D4-11 units/contracts for Company B use Company B's building — safe for
    // teardown, but we also delete them here for symmetry.
    await testApp.rawPrisma.contract.deleteMany({
      where: { companyId: fx.companies.bId, totalAmount: 800_000 },
    });
    await testApp.rawPrisma.unit.deleteMany({
      where: { companyId: fx.companies.bId, code: { startsWith: 'D4-B-U-' } },
    });
    // BonusEntry.salesId → User(RESTRICT) and BonusRule rows are not in the
    // security fixture teardown — delete them here before teardown deletes users.
    await testApp.rawPrisma.bonusEntry.deleteMany({
      where: { companyId: { in: [fx.companies.aId, fx.companies.bId] } },
    });
    await testApp.rawPrisma.bonusRule.deleteMany({
      where: { name: { startsWith: 'D4-Rule-' } },
    });
    // Safety net: drop atomicity test constraints if D4-13/D4-14 were killed before their finally ran.
    // AuditLog is written by every state-changing service; a leaked constraint destroys files 13-15.
    await testApp.rawPrisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "_d4_atomicity_commission"`).catch(() => void 0);
    await testApp.rawPrisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "_d4_atomicity_bonus"`).catch(() => void 0);
    await teardownSecurityFixture(testApp.rawPrisma);
    await testApp.close();
  });

  // ── Seed helpers ──────────────────────────────────────────────────────────

  async function freshUnit(companyId: string) {
    unitCounter++;
    return testApp.rawPrisma.unit.create({
      data: {
        buildingId: fx.resources.a.buildingId,
        code: `D4-U-${Date.now()}-${unitCounter}`,
        type: '2BR',
        area: 120,
        price: 3_000_000,
        companyId,
      },
    });
  }

  async function freshContract(unitId: string, companyId: string) {
    return testApp.rawPrisma.contract.create({
      data: {
        customerId: fx.users.customerA.id,
        unitId,
        totalAmount: 3_000_000,
        status: ContractStatus.ACTIVE,
        signedAt: new Date(),
        companyId,
      },
    });
  }

  async function seedOutstandingCommission(companyId: string, netAmount = NET_AMOUNT) {
    const broker = await testApp.rawPrisma.broker.findFirst({ where: { companyId } });
    if (!broker) throw new Error(`No broker found for company ${companyId}`);

    const unit = await freshUnit(companyId);
    const contract = await freshContract(unit.id, companyId);

    return testApp.rawPrisma.brokerCommission.create({
      data: {
        commissionNumber: `D4-COM-${Date.now()}-${unitCounter}`,
        brokerId: broker.id,
        contractId: contract.id,
        unitId: unit.id,
        projectId: fx.resources.a.projectId,
        basisAmount: 3_000_000,
        grossAmount: netAmount,
        netAmount,
        status: BrokerCommissionStatus.APPROVED,
        clawbackStatus: ClawbackStatus.OUTSTANDING,
        clawbackReason: 'Contract cancelled — test',
        clawbackAt: new Date(),
        clawbackById: fx.users.adminA.id,
        earnedAt: new Date(),
        companyId,
      },
    });
  }

  async function seedOutstandingBonus(companyId: string, amount = BONUS_AMOUNT) {
    const rule = await testApp.rawPrisma.bonusRule.create({
      data: {
        name: `D4-Rule-${Date.now()}`,
        percentage: 2,
        active: true,
        companyId,
      },
    });

    return testApp.rawPrisma.bonusEntry.create({
      data: {
        salesId: fx.users.sales1A.id,
        ruleId: rule.id,
        amount,
        period: '2026-09',
        status: BonusEntryStatus.PAID,
        paidAt: new Date(),
        clawbackStatus: ClawbackStatus.OUTSTANDING,
        clawbackReason: 'Contract cancelled — test',
        clawbackAt: new Date(),
        clawbackById: fx.users.adminA.id,
        companyId,
      },
    });
  }

  // ── D4-1: Commission OUTSTANDING → COLLECTED (full amount) ───────────────

  describe('D4-1: commission OUTSTANDING → COLLECTED (full amount)', () => {
    let commissionId: string;

    beforeAll(async () => {
      const c = await seedOutstandingCommission(fx.companies.aId);
      commissionId = c.id;

      const res = await request(testApp.app.getHttpServer())
        .post(`/v1/broker-commissions/${commissionId}/clawback/collect`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          amount: NET_AMOUNT,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          reference: 'D4-REF-001',
        });
      expect(res.status).toBe(201);
    });

    it('reads back clawbackStatus=COLLECTED', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(row!.clawbackStatus).toBe(ClawbackStatus.COLLECTED);
    });

    it('reads back correct amount, reference, payment method', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(Number(row!.clawbackCollectedAmount)).toBe(NET_AMOUNT);
      expect(row!.clawbackCollectedReference).toBe('D4-REF-001');
      expect(row!.clawbackCollectedPaymentMethod).toBe(PaymentMethod.BANK_TRANSFER);
    });

    it('Hard Rule 2: commission.status unchanged (still APPROVED)', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(row!.status).toBe(BrokerCommissionStatus.APPROVED);
    });

    it('AuditLog row written with correct action', async () => {
      const log = await testApp.rawPrisma.auditLog.findFirst({
        where: { entityId: commissionId, action: 'commission.clawback.collected' },
      });
      expect(log).not.toBeNull();
      const after = log!.after as Record<string, unknown>;
      expect(after.clawbackStatus).toBe(ClawbackStatus.COLLECTED);
      expect(after.commissionStatusUnchanged).toBe(BrokerCommissionStatus.APPROVED);
    });
  });

  // ── D4-2: Partial repayment → PARTIALLY_COLLECTED ────────────────────────

  describe('D4-2: commission partial repayment → PARTIALLY_COLLECTED (NOT COLLECTED)', () => {
    let commissionId: string;

    beforeAll(async () => {
      const c = await seedOutstandingCommission(fx.companies.aId);
      commissionId = c.id;

      const res = await request(testApp.app.getHttpServer())
        .post(`/v1/broker-commissions/${commissionId}/clawback/collect`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          amount: 50_000, // less than 75,000
          paymentMethod: PaymentMethod.CHEQUE,
        });
      expect(res.status).toBe(201);
    });

    it('clawbackStatus=PARTIALLY_COLLECTED (not COLLECTED)', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(row!.clawbackStatus).toBe(ClawbackStatus.PARTIALLY_COLLECTED);
      expect(row!.clawbackStatus).not.toBe(ClawbackStatus.COLLECTED);
    });

    it('clawbackCollectedAmount stores the partial amount', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(Number(row!.clawbackCollectedAmount)).toBe(50_000);
    });

    it('commission.status unchanged', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(row!.status).toBe(BrokerCommissionStatus.APPROVED);
    });
  });

  // ── D4-3: Second collect on PARTIALLY_COLLECTED → COLLECTED ──────────────

  describe('D4-3: second collect on PARTIALLY_COLLECTED → COLLECTED', () => {
    let commissionId: string;

    beforeAll(async () => {
      const c = await seedOutstandingCommission(fx.companies.aId);
      commissionId = c.id;
      // Pre-load 50,000 collected
      await testApp.rawPrisma.brokerCommission.update({
        where: { id: commissionId },
        data: {
          clawbackStatus: ClawbackStatus.PARTIALLY_COLLECTED,
          clawbackCollectedAmount: 50_000,
        },
      });

      const res = await request(testApp.app.getHttpServer())
        .post(`/v1/broker-commissions/${commissionId}/clawback/collect`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          amount: 25_000, // brings total to 75,000 = NET_AMOUNT
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          reference: 'D4-REF-FINAL',
        });
      expect(res.status).toBe(201);
    });

    it('clawbackStatus=COLLECTED after second payment', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(row!.clawbackStatus).toBe(ClawbackStatus.COLLECTED);
    });

    it('accumulated clawbackCollectedAmount = full net amount', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(Number(row!.clawbackCollectedAmount)).toBe(75_000);
    });
  });

  // ── D4-4: OUTSTANDING → WAIVED; waiveReason stored separately ────────────

  describe('D4-4: commission OUTSTANDING → WAIVED; waiveReason ≠ clawbackReason', () => {
    let commissionId: string;
    const CANCELLATION_REASON = 'Contract cancelled — test';
    const WAIVE_REASON = 'Financial hardship acknowledged; management approved waiver';

    beforeAll(async () => {
      const c = await seedOutstandingCommission(fx.companies.aId);
      commissionId = c.id;

      const res = await request(testApp.app.getHttpServer())
        .post(`/v1/broker-commissions/${commissionId}/clawback/waive`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({ reason: WAIVE_REASON });
      expect(res.status).toBe(201);
    });

    it('clawbackStatus=WAIVED', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(row!.clawbackStatus).toBe(ClawbackStatus.WAIVED);
    });

    it('clawbackWaiveReason stores the waive reason', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(row!.clawbackWaiveReason).toBe(WAIVE_REASON);
    });

    it('clawbackReason (cancellation reason) unchanged and distinct from waiveReason', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(row!.clawbackReason).toBe(CANCELLATION_REASON);
      expect(row!.clawbackReason).not.toBe(row!.clawbackWaiveReason);
    });

    it('commission.status unchanged', async () => {
      const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionId } });
      expect(row!.status).toBe(BrokerCommissionStatus.APPROVED);
    });
  });

  // ── D4-5: COLLECTED → 409 on second collect ───────────────────────────────

  it('D4-5: COLLECTED commission → 409 on collect (terminal)', async () => {
    const c = await seedOutstandingCommission(fx.companies.aId);
    await testApp.rawPrisma.brokerCommission.update({
      where: { id: c.id },
      data: { clawbackStatus: ClawbackStatus.COLLECTED, clawbackCollectedAmount: NET_AMOUNT },
    });

    const res = await request(testApp.app.getHttpServer())
      .post(`/v1/broker-commissions/${c.id}/clawback/collect`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .send({ amount: 1, paymentMethod: PaymentMethod.CASH });

    expect(res.status).toBe(409);

    const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: c.id } });
    expect(row!.clawbackStatus).toBe(ClawbackStatus.COLLECTED);
    expect(Number(row!.clawbackCollectedAmount)).toBe(NET_AMOUNT);
  });

  // ── D4-6: WAIVED → 409 on second waive ───────────────────────────────────

  it('D4-6: WAIVED commission → 409 on waive (terminal)', async () => {
    const c = await seedOutstandingCommission(fx.companies.aId);
    await testApp.rawPrisma.brokerCommission.update({
      where: { id: c.id },
      data: { clawbackStatus: ClawbackStatus.WAIVED, clawbackWaiveReason: 'Original waive' },
    });

    const res = await request(testApp.app.getHttpServer())
      .post(`/v1/broker-commissions/${c.id}/clawback/waive`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .send({ reason: 'Another reason' });

    expect(res.status).toBe(409);

    const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: c.id } });
    expect(row!.clawbackStatus).toBe(ClawbackStatus.WAIVED);
    expect(row!.clawbackWaiveReason).toBe('Original waive');
  });

  // ── D4-7: clawbackStatus null → 409 ──────────────────────────────────────

  it('D4-7: commission with null clawbackStatus → 409 on collect', async () => {
    const c = await seedOutstandingCommission(fx.companies.aId);
    // Reset to null clawback
    await testApp.rawPrisma.brokerCommission.update({
      where: { id: c.id },
      data: {
        clawbackStatus: null,
        clawbackReason: null,
        clawbackAt: null,
        clawbackById: null,
      },
    });

    const res = await request(testApp.app.getHttpServer())
      .post(`/v1/broker-commissions/${c.id}/clawback/collect`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .send({ amount: 1_000, paymentMethod: PaymentMethod.BANK_TRANSFER });

    expect(res.status).toBe(409);
    const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: c.id } });
    expect(row!.clawbackStatus).toBeNull();
  });

  // ── D4-8: commission.status unchanged across all resolved rows ────────────

  it('D4-8: commission.status=APPROVED in all D4-created resolved rows', async () => {
    const rows = await testApp.rawPrisma.brokerCommission.findMany({
      where: {
        companyId: fx.companies.aId,
        commissionNumber: { startsWith: 'D4-COM-' },
      },
      select: { status: true, clawbackStatus: true },
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.status).toBe(BrokerCommissionStatus.APPROVED);
    }
  });

  // ── D4-9: BonusEntry OUTSTANDING → COLLECTED ─────────────────────────────

  describe('D4-9: BonusEntry OUTSTANDING → COLLECTED; bonusEntry.status unchanged', () => {
    let bonusId: string;

    beforeAll(async () => {
      const b = await seedOutstandingBonus(fx.companies.aId);
      bonusId = b.id;

      const res = await request(testApp.app.getHttpServer())
        .post(`/v1/bonus-entries/${bonusId}/clawback/collect`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          amount: BONUS_AMOUNT,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          reference: 'BNS-REF-001',
        });
      expect(res.status).toBe(201);
    });

    it('reads back clawbackStatus=COLLECTED', async () => {
      const row = await testApp.rawPrisma.bonusEntry.findUnique({ where: { id: bonusId } });
      expect(row!.clawbackStatus).toBe(ClawbackStatus.COLLECTED);
    });

    it('clawbackCollectedAmount and reference stored', async () => {
      const row = await testApp.rawPrisma.bonusEntry.findUnique({ where: { id: bonusId } });
      expect(Number(row!.clawbackCollectedAmount)).toBe(BONUS_AMOUNT);
      expect(row!.clawbackCollectedReference).toBe('BNS-REF-001');
    });

    it('Hard Rule 2: bonusEntry.status=PAID unchanged', async () => {
      const row = await testApp.rawPrisma.bonusEntry.findUnique({ where: { id: bonusId } });
      expect(row!.status).toBe(BonusEntryStatus.PAID);
    });
  });

  // ── D4-10: BonusEntry OUTSTANDING → WAIVED; reasons distinct ─────────────

  describe('D4-10: BonusEntry OUTSTANDING → WAIVED; waiveReason ≠ clawbackReason', () => {
    let bonusId: string;
    const CANCEL_REASON = 'Contract cancelled — test';
    const WAIVE_REASON = 'Management waived per settlement agreement';

    beforeAll(async () => {
      const b = await seedOutstandingBonus(fx.companies.aId);
      bonusId = b.id;

      const res = await request(testApp.app.getHttpServer())
        .post(`/v1/bonus-entries/${bonusId}/clawback/waive`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({ reason: WAIVE_REASON });
      expect(res.status).toBe(201);
    });

    it('clawbackStatus=WAIVED', async () => {
      const row = await testApp.rawPrisma.bonusEntry.findUnique({ where: { id: bonusId } });
      expect(row!.clawbackStatus).toBe(ClawbackStatus.WAIVED);
    });

    it('waiveReason and clawbackReason are both readable and distinct', async () => {
      const row = await testApp.rawPrisma.bonusEntry.findUnique({ where: { id: bonusId } });
      expect(row!.clawbackWaiveReason).toBe(WAIVE_REASON);
      expect(row!.clawbackReason).toBe(CANCEL_REASON);
      expect(row!.clawbackWaiveReason).not.toBe(row!.clawbackReason);
    });

    it('bonusEntry.status=PAID unchanged', async () => {
      const row = await testApp.rawPrisma.bonusEntry.findUnique({ where: { id: bonusId } });
      expect(row!.status).toBe(BonusEntryStatus.PAID);
    });
  });

  // ── D4-11: Cross-tenant — Commission ─────────────────────────────────────

  it('D4-11: cross-tenant commission collect → 404 (not 403)', async () => {
    // Use Company B's own building so teardown can delete it without FK conflicts
    const buildingB = await testApp.rawPrisma.building.findFirst({ where: { companyId: fx.companies.bId } });
    if (!buildingB) throw new Error('Company B building not found in fixture');

    // Create a broker + commission in Company B
    const brokerB = await testApp.rawPrisma.broker.create({
      data: {
        companyName: 'D4-Broker-B',
        code: `D4-BRK-B-${Date.now()}`,
        status: BrokerStatus.ACTIVE,
        createdById: fx.users.adminB.id,
        companyId: fx.companies.bId,
      },
    });
    const unit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId: buildingB.id,
        code: `D4-B-U-${Date.now()}`,
        type: '1BR',
        area: 80,
        price: 800_000,
        companyId: fx.companies.bId,
      },
    });
    const contract = await testApp.rawPrisma.contract.create({
      data: {
        customerId: fx.users.customerB.id,
        unitId: unit.id,
        totalAmount: 800_000,
        status: ContractStatus.ACTIVE,
        signedAt: new Date(),
        companyId: fx.companies.bId,
      },
    });
    const commissionB = await testApp.rawPrisma.brokerCommission.create({
      data: {
        commissionNumber: `D4-XTEN-${Date.now()}`,
        brokerId: brokerB.id,
        contractId: contract.id,
        unitId: unit.id,
        projectId: fx.resources.a.projectId,
        basisAmount: 800_000,
        grossAmount: 25_000,
        netAmount: 25_000,
        status: BrokerCommissionStatus.APPROVED,
        clawbackStatus: ClawbackStatus.OUTSTANDING,
        clawbackReason: 'Cross-tenant test',
        clawbackAt: new Date(),
        clawbackById: fx.users.adminB.id,
        earnedAt: new Date(),
        companyId: fx.companies.bId,
      },
    });

    // adminA (Company A) tries to collect Company B's commission
    const res = await request(testApp.app.getHttpServer())
      .post(`/v1/broker-commissions/${commissionB.id}/clawback/collect`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .send({ amount: 1_000, paymentMethod: PaymentMethod.BANK_TRANSFER });

    expect(res.status).toBe(404);

    // The row must be unchanged
    const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: commissionB.id } });
    expect(row!.clawbackStatus).toBe(ClawbackStatus.OUTSTANDING);
    expect(row!.clawbackCollectedAmount).toBeNull();
  });

  // ── D4-12: Cross-tenant — BonusEntry ─────────────────────────────────────

  it('D4-12: cross-tenant bonus waive → 404 (not 403)', async () => {
    const rule = await testApp.rawPrisma.bonusRule.create({
      data: { name: `D4-Rule-B-${Date.now()}`, percentage: 2, active: true, companyId: fx.companies.bId },
    });
    const bonusB = await testApp.rawPrisma.bonusEntry.create({
      data: {
        salesId: fx.users.adminB.id,
        ruleId: rule.id,
        amount: 10_000,
        period: '2026-09',
        status: BonusEntryStatus.PAID,
        paidAt: new Date(),
        clawbackStatus: ClawbackStatus.OUTSTANDING,
        clawbackReason: 'Cross-tenant waive test',
        clawbackAt: new Date(),
        clawbackById: fx.users.adminB.id,
        companyId: fx.companies.bId,
      },
    });

    // adminA (Company A) tries to waive Company B's bonus
    const res = await request(testApp.app.getHttpServer())
      .post(`/v1/bonus-entries/${bonusB.id}/clawback/waive`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .send({ reason: 'cross-tenant waive attempt' });

    expect(res.status).toBe(404);

    const row = await testApp.rawPrisma.bonusEntry.findUnique({ where: { id: bonusB.id } });
    expect(row!.clawbackStatus).toBe(ClawbackStatus.OUTSTANDING);
    expect(row!.clawbackWaiveReason).toBeNull();
  });

  // ── D4-13: Atomicity — commission collect ────────────────────────────────

  it('D4-13: atomicity — DB failure on commission collect; nothing changes', async () => {
    const c = await seedOutstandingCommission(fx.companies.aId);

    // Add NOT VALID CHECK on AuditLog to force the transaction to fail during
    // auditLog.create (which happens inside the $transaction after the update).
    await testApp.rawPrisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" ADD CONSTRAINT "_d4_atomicity_commission" CHECK (1 = 0) NOT VALID`,
    );

    let res;
    try {
      res = await request(testApp.app.getHttpServer())
        .post(`/v1/broker-commissions/${c.id}/clawback/collect`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({ amount: NET_AMOUNT, paymentMethod: PaymentMethod.BANK_TRANSFER });
    } finally {
      await testApp.rawPrisma.$executeRawUnsafe(
        `ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "_d4_atomicity_commission"`,
      );
    }

    expect(res!.status).toBe(500);

    // Commission must be unchanged
    const row = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: c.id } });
    expect(row!.clawbackStatus).toBe(ClawbackStatus.OUTSTANDING);
    expect(row!.clawbackCollectedAmount).toBeNull();
    expect(row!.clawbackCollectedPaymentMethod).toBeNull();
  });

  // ── D4-14: Atomicity — bonus waive ───────────────────────────────────────

  it('D4-14: atomicity — DB failure on bonus waive; nothing changes', async () => {
    const b = await seedOutstandingBonus(fx.companies.aId);

    await testApp.rawPrisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" ADD CONSTRAINT "_d4_atomicity_bonus" CHECK (1 = 0) NOT VALID`,
    );

    let res;
    try {
      res = await request(testApp.app.getHttpServer())
        .post(`/v1/bonus-entries/${b.id}/clawback/waive`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({ reason: 'Atomicity test waive' });
    } finally {
      await testApp.rawPrisma.$executeRawUnsafe(
        `ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "_d4_atomicity_bonus"`,
      );
    }

    expect(res!.status).toBe(500);

    const row = await testApp.rawPrisma.bonusEntry.findUnique({ where: { id: b.id } });
    expect(row!.clawbackStatus).toBe(ClawbackStatus.OUTSTANDING);
    expect(row!.clawbackWaiveReason).toBeNull();
  });
});
