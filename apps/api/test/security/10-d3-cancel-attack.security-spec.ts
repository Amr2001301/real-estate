/**
 * Step D3 — contracts:cancel + contracts:release-unit security and e2e tests.
 *
 * All tests use real Postgres (TEST_DATABASE_URL). Rows are read back from the
 * database after each operation. No test returns early on a missing precondition
 * — missing rows throw so the failure is visible.
 *
 * Test matrix:
 *   S2      Full scenario walkthrough (09-reversal-design.md §4.6 S2):
 *           6 of 60 installments PAID; commission in PAID payout; REQUIRES_APPROVAL.
 *           Asserts every changed/unchanged row including Hard Rule 2 invariants.
 *   D3-5   CANCELLED is terminal — second cancel returns 409  (shares S2 state)
 *   D3-1   release-unit flips unit AVAILABLE, writes UnitStatusHistory, sets unitReleasedAt
 *           (uses its own isolated contract to avoid ordering dependencies with S2)
 *   D3-2   AUTO setting releases unit inside the cancel transaction
 *   D3-3   Operator-submitted amounts stored verbatim (not the suggestion)
 *   D3-4   Unsigned contract cancel works — CC row created with zero amounts (OQ-2)
 *   D3-6   Atomicity: force CHECK(1=0) NOT VALID on ContractCancellation; assert rollback
 *           (contract still ACTIVE, installments still PENDING, no CC row)
 *   D3-7   Cross-tenant cancel: Company A admin → Company B contract → 404
 *   D3-8   Cross-tenant release-unit: Company A admin → Company B contract → 404
 *
 * Design notes:
 *   - State-mutating tests that depend on prior state run inside nested describes
 *     whose beforeAll performs the state-changing operation. This ensures tests
 *     are order-independent even under --randomize.
 *   - D3-1 creates its own contract/unit so it is independent of S2.
 *   - D3-6 uses NOT VALID to avoid failing when pre-existing CC rows exist.
 */

import request from 'supertest';
import { BrokerCommissionStatus, ContractStatus, InstallmentStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  type SecurityFixture,
} from './seed/security-fixture';
import { seedCancellationSettingsForCompany } from '../../src/modules/contracts/cancellation-settings.constants';

let testApp: TestApp;
let fx: SecurityFixture;
let adminAToken: string;

describe('SEC — D3: contracts:cancel + contracts:release-unit (Step D3)', () => {
  beforeAll(async () => {
    testApp = await createTestApp();
    fx = await seedSecurityFixture(testApp.rawPrisma);

    // Seed D2 cancellation settings for both fixture companies
    await Promise.all([
      seedCancellationSettingsForCompany(testApp.rawPrisma, fx.companies.aId),
      seedCancellationSettingsForCompany(testApp.rawPrisma, fx.companies.bId),
    ]);

    adminAToken = await loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password);

    // Grant contracts:cancel + contracts:release-unit to adminA
    for (const code of ['contracts:cancel', 'contracts:release-unit']) {
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
    await teardownSecurityFixture(testApp.rawPrisma);
    await testApp.close();
  });

  // ── S2 scenario + D3-5 terminal test ─────────────────────────────────────
  //
  // The cancel call is in beforeAll so all tests in this nested describe see
  // the post-cancel state regardless of --randomize ordering.
  //
  // Starting state: Contract C1 ACTIVE, 60 × 50,000 installments,
  // inst1-6 PAID, inst7-60 PENDING, booking deposit 25,000 APPROVED,
  // BC1 APPROVED in PAID payout, BE1 PAID, unit SOLD.
  //
  // Operator submits: retained=50,000 refund=275,000 (differ from suggestion).
  // Setting: unit.returnToAvailable = REQUIRES_APPROVAL (default).

  describe('S2: full scenario walkthrough (§4.6)', () => {
    let s2ContractId: string;
    let s2UnitId: string;
    let s2PlanId: string;
    let s2CommissionId: string;
    let s2BonusId: string;
    let s2Inst1Id: string;
    let s2Inst7Id: string;

    beforeAll(async () => {
      // ── Build S2 scenario ─────────────────────────────────────────────
      const s2Unit = await testApp.rawPrisma.unit.create({
        data: {
          buildingId: fx.resources.a.buildingId,
          code: 'D3-S2-UNIT',
          type: '2BR',
          area: 120,
          price: 3_000_000,
          status: UnitStatus.SOLD,
          companyId: fx.companies.aId,
        },
      });
      s2UnitId = s2Unit.id;

      const s2Contract = await testApp.rawPrisma.contract.create({
        data: {
          customerId: fx.users.customerA.id,
          unitId: s2UnitId,
          totalAmount: 3_000_000,
          signedAt: new Date('2026-09-01'),
          status: ContractStatus.ACTIVE,
          companyId: fx.companies.aId,
        },
      });
      s2ContractId = s2Contract.id;

      const s2Plan = await testApp.rawPrisma.installmentPlan.create({
        data: {
          contractId: s2ContractId,
          totalMonths: 60,
          monthlyAmount: 50_000,
          startsAt: new Date('2026-10-01'),
          companyId: fx.companies.aId,
        },
      });
      s2PlanId = s2Plan.id;

      const installments: { id: string }[] = [];
      for (let i = 1; i <= 60; i++) {
        const inst = await testApp.rawPrisma.installment.create({
          data: {
            planId: s2PlanId,
            dueDate: new Date(2026, 8 + i, 1),
            amount: 50_000,
            status: i <= 6 ? InstallmentStatus.PAID : InstallmentStatus.PENDING,
            paidAt: i <= 6 ? new Date('2026-10-01') : null,
            companyId: fx.companies.aId,
          },
        });
        installments.push({ id: inst.id });
      }
      s2Inst1Id = installments[0]!.id;
      s2Inst7Id = installments[6]!.id;

      // 6 installment deposits + 1 booking deposit (all APPROVED)
      for (let i = 0; i < 6; i++) {
        await testApp.rawPrisma.deposit.create({
          data: {
            contractId: s2ContractId,
            installmentId: installments[i]!.id,
            type: 'INSTALLMENT',
            amount: 50_000,
            paidAt: new Date('2026-10-01'),
            reviewStatus: 'APPROVED',
            verified: true,
            recordedById: fx.users.adminA.id,
            companyId: fx.companies.aId,
          },
        });
      }
      await testApp.rawPrisma.deposit.create({
        data: {
          contractId: s2ContractId,
          type: 'BOOKING_AMOUNT',
          amount: 25_000,
          paidAt: new Date('2026-09-01'),
          reviewStatus: 'APPROVED',
          verified: true,
          recordedById: fx.users.adminA.id,
          companyId: fx.companies.aId,
        },
      });

      const s2Payout = await testApp.rawPrisma.brokerPayout.create({
        data: {
          payoutNumber: 'PAY-D3-S2-001',
          brokerId: fx.resources.a.brokerId,
          status: 'PAID',
          companyId: fx.companies.aId,
        },
      });

      const s2Commission = await testApp.rawPrisma.brokerCommission.create({
        data: {
          commissionNumber: 'BC-D3-S2-001',
          brokerId: fx.resources.a.brokerId,
          contractId: s2ContractId,
          unitId: s2UnitId,
          projectId: fx.resources.a.projectId,
          basisAmount: 3_000_000,
          commissionPct: 2.5,
          grossAmount: 75_000,
          netAmount: 75_000,
          status: BrokerCommissionStatus.APPROVED,
          earnedAt: new Date('2026-09-01'),
          payoutId: s2Payout.id,
          companyId: fx.companies.aId,
        },
      });
      s2CommissionId = s2Commission.id;

      const s2BonusRule = await testApp.rawPrisma.bonusRule.create({
        data: {
          name: 'D3-S2 Bonus Rule',
          percentage: 2,
          active: true,
          companyId: fx.companies.aId,
        },
      });

      const s2Bonus = await testApp.rawPrisma.bonusEntry.create({
        data: {
          salesId: fx.users.sales1A.id,
          ruleId: s2BonusRule.id,
          amount: 20_000,
          period: '2026-09',
          status: 'PAID',
          contractId: s2ContractId,
          companyId: fx.companies.aId,
        },
      });
      s2BonusId = s2Bonus.id;

      // ── Perform the cancel ─────────────────────────────────────────────
      const res = await request(testApp.app.getHttpServer())
        .post(`/v1/contracts/${s2ContractId}/cancel`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          reason: 'Mutual agreement — minor penalty deviation',
          retainedAmount: 50_000,
          refundAmount: 275_000,
          clawbackReason: 'Contract cancelled; commission recovery per agreement.',
        });
      if (res.status !== 201) {
        throw new Error(`S2 beforeAll cancel failed: status=${res.status} body=${JSON.stringify(res.body)}`);
      }
    }, 90_000);

    afterAll(async () => {
      await testApp.rawPrisma.bonusEntry.deleteMany({ where: { contractId: s2ContractId } }).catch(() => void 0);
      await testApp.rawPrisma.bonusRule.deleteMany({ where: { name: 'D3-S2 Bonus Rule' } }).catch(() => void 0);
      await testApp.rawPrisma.brokerCommission.deleteMany({ where: { contractId: s2ContractId } }).catch(() => void 0);
      await testApp.rawPrisma.brokerPayout.deleteMany({ where: { payoutNumber: 'PAY-D3-S2-001' } }).catch(() => void 0);
      await testApp.rawPrisma.deposit.deleteMany({ where: { contractId: s2ContractId } }).catch(() => void 0);
      await testApp.rawPrisma.installment.deleteMany({ where: { planId: s2PlanId } }).catch(() => void 0);
      await testApp.rawPrisma.installmentPlan.deleteMany({ where: { contractId: s2ContractId } }).catch(() => void 0);
      await testApp.rawPrisma.contractCancellation.deleteMany({ where: { contractId: s2ContractId } }).catch(() => void 0);
      await testApp.rawPrisma.contract.deleteMany({ where: { id: s2ContractId } }).catch(() => void 0);
      await testApp.rawPrisma.unit.deleteMany({ where: { id: s2UnitId } }).catch(() => void 0);
    });

    it('S2: cancel() writes every row in §4.6 correctly', async () => {
      // ── Contract → CANCELLED ─────────────────────────────────────────
      const contract = await testApp.rawPrisma.contract.findUnique({ where: { id: s2ContractId } });
      if (!contract) throw new Error('S2: contract not found after cancel');
      expect(contract.status).toBe(ContractStatus.CANCELLED);
      expect(contract.cancelledAt).toBeTruthy();
      expect(contract.signedAt).not.toBeNull(); // PRESERVED

      // ── InstallmentPlan → cancelledAt ────────────────────────────────
      const plan = await testApp.rawPrisma.installmentPlan.findUnique({ where: { id: s2PlanId } });
      if (!plan) throw new Error('S2: plan not found');
      expect(plan.cancelledAt).toBeTruthy();

      // ── Installments 1-6: PAID (unchanged) ───────────────────────────
      const inst1 = await testApp.rawPrisma.installment.findUnique({ where: { id: s2Inst1Id } });
      if (!inst1) throw new Error('S2: inst1 not found');
      expect(inst1.status).toBe(InstallmentStatus.PAID);

      // ── Installments 7-60: CANCELLED (54 rows) ───────────────────────
      const inst7 = await testApp.rawPrisma.installment.findUnique({ where: { id: s2Inst7Id } });
      if (!inst7) throw new Error('S2: inst7 not found');
      expect(inst7.status).toBe(InstallmentStatus.CANCELLED);

      const cancelledCount = await testApp.rawPrisma.installment.count({
        where: { planId: s2PlanId, status: InstallmentStatus.CANCELLED },
      });
      expect(cancelledCount).toBe(54);

      // ── ContractCancellation row ──────────────────────────────────────
      const cc = await testApp.rawPrisma.contractCancellation.findUnique({
        where: { contractId: s2ContractId },
      });
      if (!cc) throw new Error('S2: ContractCancellation not found');
      // Operator-submitted amounts (not suggestion)
      expect(Number(cc.retainedAmount)).toBe(50_000);
      expect(Number(cc.refundAmount)).toBe(275_000);
      // totalCollectedSnapshot: 6×50,000 + 25,000 = 325,000
      expect(Number(cc.totalCollectedSnapshot)).toBe(325_000);
      // policySnapshot captures setting values at cancellation time
      const snap = cc.policySnapshot as Record<string, unknown>;
      expect(snap['penaltyPct']).toBe(10);
      expect(snap['bookingRefundPct']).toBe(0);
      expect(snap['unitRelease']).toBe('REQUIRES_APPROVAL');
      // Unit NOT yet released (REQUIRES_APPROVAL path)
      expect(cc.unitReleasedAt).toBeNull();
      // Customer NOT demoted (default false)
      expect(cc.customerDemotedAt).toBeNull();

      // ── BC1: APPROVED unchanged (Hard Rule 2); clawbackStatus OUTSTANDING ─
      const bc1 = await testApp.rawPrisma.brokerCommission.findUnique({ where: { id: s2CommissionId } });
      if (!bc1) throw new Error('S2: BC1 not found');
      expect(bc1.status).toBe(BrokerCommissionStatus.APPROVED); // NEVER changed
      expect(bc1.clawbackStatus).toBe('OUTSTANDING');
      expect(bc1.clawbackReason).toBe('Contract cancelled; commission recovery per agreement.');
      expect(bc1.clawbackAt).toBeTruthy();

      // ── BE1: PAID unchanged (Hard Rule 2); clawbackStatus OUTSTANDING ────
      const be1 = await testApp.rawPrisma.bonusEntry.findUnique({ where: { id: s2BonusId } });
      if (!be1) throw new Error('S2: BE1 not found');
      expect(be1.status).toBe('PAID'); // Hard Rule 2
      expect(be1.clawbackStatus).toBe('OUTSTANDING');

      // ── Unit: still SOLD (REQUIRES_APPROVAL — not yet released) ─────────
      const unit = await testApp.rawPrisma.unit.findUnique({ where: { id: s2UnitId } });
      if (!unit) throw new Error('S2: unit not found');
      expect(unit.status).toBe(UnitStatus.SOLD);

      // ── Deposits: all APPROVED (untouched) ──────────────────────────────
      const deposits = await testApp.rawPrisma.deposit.findMany({
        where: { contractId: s2ContractId },
        select: { reviewStatus: true },
      });
      expect(deposits.every((d) => d.reviewStatus === 'APPROVED')).toBe(true);
    });

    it('D3-5: CANCELLED is terminal — second cancel returns 409', async () => {
      await request(testApp.app.getHttpServer())
        .post(`/v1/contracts/${s2ContractId}/cancel`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          reason: 'Duplicate cancel attempt',
          retainedAmount: 0,
          refundAmount: 0,
        })
        .expect(409);
    });
  });

  // ── D3-1: release-unit (independent contract — not S2) ───────────────────
  // Uses a fresh cancelled contract so this test is independent of the S2
  // describe and can run in any order under --randomize.

  it('D3-1: release-unit flips unit AVAILABLE, writes UnitStatusHistory, sets unitReleasedAt', async () => {
    const d1Unit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId: fx.resources.a.buildingId,
        code: 'D3-D1-UNIT',
        type: '1BR',
        area: 80,
        price: 1_000_000,
        status: UnitStatus.SOLD,
        companyId: fx.companies.aId,
      },
    });
    const d1Contract = await testApp.rawPrisma.contract.create({
      data: {
        customerId: fx.users.customerA.id,
        unitId: d1Unit.id,
        totalAmount: 1_000_000,
        signedAt: new Date('2026-09-01'),
        status: ContractStatus.ACTIVE,
        companyId: fx.companies.aId,
      },
    });

    try {
      // Cancel first (REQUIRES_APPROVAL — unit stays SOLD)
      const cancelRes = await request(testApp.app.getHttpServer())
        .post(`/v1/contracts/${d1Contract.id}/cancel`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          reason: 'D3-1 release-unit test',
          retainedAmount: 0,
          refundAmount: 0,
        })
        .expect(201);
      expect(cancelRes.body.unitReleasedAt).toBeNull();

      // Now release the unit
      const releaseRes = await request(testApp.app.getHttpServer())
        .post(`/v1/contracts/${d1Contract.id}/release-unit`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .expect(201);
      expect(releaseRes.body).toBeDefined();

      // Unit → AVAILABLE
      const unit = await testApp.rawPrisma.unit.findUnique({ where: { id: d1Unit.id } });
      if (!unit) throw new Error('D3-1: unit not found');
      expect(unit.status).toBe(UnitStatus.AVAILABLE);

      // UnitStatusHistory written
      const history = await testApp.rawPrisma.unitStatusHistory.findFirst({
        where: { unitId: d1Unit.id, newStatus: UnitStatus.AVAILABLE },
        orderBy: { changedAt: 'desc' },
      });
      if (!history) throw new Error('D3-1: no UnitStatusHistory row found');
      expect(history.oldStatus).toBe(UnitStatus.SOLD);

      // unitReleasedAt set on ContractCancellation
      const cc = await testApp.rawPrisma.contractCancellation.findUnique({
        where: { contractId: d1Contract.id },
      });
      if (!cc) throw new Error('D3-1: CC not found');
      expect(cc.unitReleasedAt).toBeTruthy();
    } finally {
      await testApp.rawPrisma.contractCancellation.deleteMany({ where: { contractId: d1Contract.id } }).catch(() => void 0);
      await testApp.rawPrisma.contract.deleteMany({ where: { id: d1Contract.id } }).catch(() => void 0);
      await testApp.rawPrisma.unit.deleteMany({ where: { id: d1Unit.id } }).catch(() => void 0);
    }
  });

  // ── D3-2: AUTO unit release ───────────────────────────────────────────────

  it('D3-2: AUTO unitReleaseOverride releases unit inside the cancel transaction', async () => {
    const autoUnit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId: fx.resources.a.buildingId,
        code: 'D3-AUTO-UNIT',
        type: '1BR',
        area: 80,
        price: 1_000_000,
        status: UnitStatus.SOLD,
        companyId: fx.companies.aId,
      },
    });
    const autoContract = await testApp.rawPrisma.contract.create({
      data: {
        customerId: fx.users.customerA.id,
        unitId: autoUnit.id,
        totalAmount: 1_000_000,
        signedAt: new Date('2026-09-01'),
        status: ContractStatus.ACTIVE,
        companyId: fx.companies.aId,
      },
    });

    try {
      const res = await request(testApp.app.getHttpServer())
        .post(`/v1/contracts/${autoContract.id}/cancel`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          reason: 'AUTO release test',
          retainedAmount: 0,
          refundAmount: 0,
          unitReleaseOverride: 'AUTO',
        })
        .expect(201);

      expect(res.body.unitReleasedAt).toBeTruthy();

      // Unit immediately AVAILABLE — no second call needed
      const unit = await testApp.rawPrisma.unit.findUnique({ where: { id: autoUnit.id } });
      if (!unit) throw new Error('D3-2: unit not found');
      expect(unit.status).toBe(UnitStatus.AVAILABLE);

      // CC.unitReleasedAt set
      const cc = await testApp.rawPrisma.contractCancellation.findUnique({
        where: { contractId: autoContract.id },
      });
      if (!cc) throw new Error('D3-2: CC not found');
      expect(cc.unitReleasedAt).toBeTruthy();
    } finally {
      await testApp.rawPrisma.contractCancellation.deleteMany({ where: { contractId: autoContract.id } }).catch(() => void 0);
      await testApp.rawPrisma.contract.deleteMany({ where: { id: autoContract.id } }).catch(() => void 0);
      await testApp.rawPrisma.unit.deleteMany({ where: { id: autoUnit.id } }).catch(() => void 0);
    }
  });

  // ── D3-3: Operator amounts stored verbatim ────────────────────────────────

  it('D3-3: operator-submitted amounts stored verbatim — values differ from suggestion', async () => {
    const opUnit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId: fx.resources.a.buildingId,
        code: 'D3-OP-UNIT',
        type: '1BR',
        area: 80,
        price: 1_000_000,
        status: UnitStatus.SOLD,
        companyId: fx.companies.aId,
      },
    });
    const opContract = await testApp.rawPrisma.contract.create({
      data: {
        customerId: fx.users.customerA.id,
        unitId: opUnit.id,
        totalAmount: 1_000_000,
        signedAt: new Date('2026-09-01'),
        status: ContractStatus.ACTIVE,
        companyId: fx.companies.aId,
      },
    });

    try {
      await request(testApp.app.getHttpServer())
        .post(`/v1/contracts/${opContract.id}/cancel`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          reason: 'Operator amounts test',
          retainedAmount: 88_888,
          refundAmount: 11_111,
        })
        .expect(201);

      const cc = await testApp.rawPrisma.contractCancellation.findUnique({
        where: { contractId: opContract.id },
      });
      if (!cc) throw new Error('D3-3: CC not found');
      // Stored amounts must exactly match what the operator submitted
      expect(Number(cc.retainedAmount)).toBe(88_888);
      expect(Number(cc.refundAmount)).toBe(11_111);
      // No approved deposits → totalCollectedSnapshot = 0
      expect(Number(cc.totalCollectedSnapshot)).toBe(0);
    } finally {
      await testApp.rawPrisma.contractCancellation.deleteMany({ where: { contractId: opContract.id } }).catch(() => void 0);
      await testApp.rawPrisma.contract.deleteMany({ where: { id: opContract.id } }).catch(() => void 0);
      await testApp.rawPrisma.unit.deleteMany({ where: { id: opUnit.id } }).catch(() => void 0);
    }
  });

  // ── D3-4: Unsigned contract (OQ-2 default) ───────────────────────────────

  it('D3-4: UNSIGNED contract can be cancelled — CC row created with zero amounts', async () => {
    const uUnit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId: fx.resources.a.buildingId,
        code: 'D3-UNSIGNED-UNIT',
        type: '1BR',
        area: 80,
        price: 500_000,
        status: UnitStatus.AVAILABLE,
        companyId: fx.companies.aId,
      },
    });
    const uContract = await testApp.rawPrisma.contract.create({
      data: {
        customerId: fx.users.customerA.id,
        unitId: uUnit.id,
        totalAmount: 500_000,
        signedAt: null,
        status: ContractStatus.UNSIGNED,
        companyId: fx.companies.aId,
      },
    });

    try {
      const res = await request(testApp.app.getHttpServer())
        .post(`/v1/contracts/${uContract.id}/cancel`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          reason: 'Customer withdrew before signing',
          retainedAmount: 0,
          refundAmount: 0,
        })
        .expect(201);

      expect(res.body.contractId).toBe(uContract.id);

      const contract = await testApp.rawPrisma.contract.findUnique({ where: { id: uContract.id } });
      if (!contract) throw new Error('D3-4: contract not found');
      expect(contract.status).toBe(ContractStatus.CANCELLED);
      expect(contract.signedAt).toBeNull(); // signedAt stays null

      const cc = await testApp.rawPrisma.contractCancellation.findUnique({
        where: { contractId: uContract.id },
      });
      if (!cc) throw new Error('D3-4: CC not found');
      expect(Number(cc.retainedAmount)).toBe(0);
      expect(Number(cc.refundAmount)).toBe(0);
    } finally {
      await testApp.rawPrisma.contractCancellation.deleteMany({ where: { contractId: uContract.id } }).catch(() => void 0);
      await testApp.rawPrisma.contract.deleteMany({ where: { id: uContract.id } }).catch(() => void 0);
      await testApp.rawPrisma.unit.deleteMany({ where: { id: uUnit.id } }).catch(() => void 0);
    }
  });

  // ── D3-6: Atomicity ───────────────────────────────────────────────────────
  // Forces a CHECK(1=0) NOT VALID constraint on ContractCancellation so the
  // create inside the $transaction always fails without rejecting pre-existing
  // rows (NOT VALID = no table scan at ADD CONSTRAINT time).
  // Asserts full rollback: contract still ACTIVE, installments still PENDING,
  // no CC row.

  describe('D3-6: atomicity — full rollback on ContractCancellation create failure', () => {
    let atomicContractId = '00000000-0000-0000-0000-000000000000';
    let atomicUnitId = '00000000-0000-0000-0000-000000000001';
    let atomicPlanId = '00000000-0000-0000-0000-000000000002';
    let atomicInstId = '00000000-0000-0000-0000-000000000003';

    beforeAll(async () => {
      const atomicUnit = await testApp.rawPrisma.unit.create({
        data: {
          buildingId: fx.resources.a.buildingId,
          code: 'D3-ATOMIC-UNIT',
          type: '1BR',
          area: 80,
          price: 500_000,
          status: UnitStatus.SOLD,
          companyId: fx.companies.aId,
        },
      });
      atomicUnitId = atomicUnit.id;

      const atomicContract = await testApp.rawPrisma.contract.create({
        data: {
          customerId: fx.users.customerA.id,
          unitId: atomicUnitId,
          totalAmount: 500_000,
          signedAt: new Date('2026-09-01'),
          status: ContractStatus.ACTIVE,
          companyId: fx.companies.aId,
        },
      });
      atomicContractId = atomicContract.id;

      const atomicPlan = await testApp.rawPrisma.installmentPlan.create({
        data: {
          contractId: atomicContractId,
          totalMonths: 3,
          monthlyAmount: 150_000,
          startsAt: new Date('2026-10-01'),
          companyId: fx.companies.aId,
        },
      });
      atomicPlanId = atomicPlan.id;

      const atomicInst = await testApp.rawPrisma.installment.create({
        data: {
          planId: atomicPlanId,
          dueDate: new Date('2026-10-01'),
          amount: 150_000,
          status: InstallmentStatus.PENDING,
          companyId: fx.companies.aId,
        },
      });
      atomicInstId = atomicInst.id;
    }, 60_000);

    afterAll(async () => {
      // Drop constraint in case test failed before its own finally block ran
      await testApp.rawPrisma.$executeRaw`ALTER TABLE "ContractCancellation" DROP CONSTRAINT IF EXISTS "d3_atomic_check"`.catch(() => void 0);
      if (atomicPlanId !== '00000000-0000-0000-0000-000000000002') {
        await testApp.rawPrisma.installment.deleteMany({ where: { planId: atomicPlanId } }).catch(() => void 0);
        await testApp.rawPrisma.installmentPlan.deleteMany({ where: { id: atomicPlanId } }).catch(() => void 0);
      }
      if (atomicContractId !== '00000000-0000-0000-0000-000000000000') {
        await testApp.rawPrisma.contractCancellation.deleteMany({ where: { contractId: atomicContractId } }).catch(() => void 0);
        await testApp.rawPrisma.contract.deleteMany({ where: { id: atomicContractId } }).catch(() => void 0);
      }
      if (atomicUnitId !== '00000000-0000-0000-0000-000000000001') {
        await testApp.rawPrisma.unit.deleteMany({ where: { id: atomicUnitId } }).catch(() => void 0);
      }
    });

    it('D3-6: forced ContractCancellation.create failure rolls back entire cancel transaction', async () => {
      try {
        // NOT VALID: add constraint without scanning existing rows; new inserts still fail
        await testApp.rawPrisma.$executeRaw`ALTER TABLE "ContractCancellation" ADD CONSTRAINT "d3_atomic_check" CHECK (1 = 0) NOT VALID`;

        const res = await request(testApp.app.getHttpServer())
          .post(`/v1/contracts/${atomicContractId}/cancel`)
          .set('Authorization', bearer(adminAToken))
          .set('X-Tenant-Slug', SEC_SLUG_A)
          .send({
            reason: 'Atomicity test',
            retainedAmount: 0,
            refundAmount: 0,
          });

        expect(res.status).toBeGreaterThanOrEqual(400);

        // Contract still ACTIVE
        const contract = await testApp.rawPrisma.contract.findUnique({ where: { id: atomicContractId } });
        if (!contract) throw new Error('D3-6: contract not found');
        expect(contract.status).toBe(ContractStatus.ACTIVE);
        expect(contract.cancelledAt).toBeNull();

        // InstallmentPlan.cancelledAt still null
        const plan = await testApp.rawPrisma.installmentPlan.findUnique({ where: { id: atomicPlanId } });
        if (!plan) throw new Error('D3-6: plan not found');
        expect(plan.cancelledAt).toBeNull();

        // Installment still PENDING
        const inst = await testApp.rawPrisma.installment.findUnique({ where: { id: atomicInstId } });
        if (!inst) throw new Error('D3-6: installment not found');
        expect(inst.status).toBe(InstallmentStatus.PENDING);

        // No ContractCancellation row created
        const cc = await testApp.rawPrisma.contractCancellation.findUnique({
          where: { contractId: atomicContractId },
        });
        expect(cc).toBeNull();
      } finally {
        await testApp.rawPrisma.$executeRaw`ALTER TABLE "ContractCancellation" DROP CONSTRAINT IF EXISTS "d3_atomic_check"`;
      }
    });
  });

  // ── D3-7/D3-8: Cross-tenant attack matrix ────────────────────────────────

  it('D3-7: Company A admin cannot cancel Company B contract → 404', async () => {
    const bContract = await testApp.rawPrisma.contract.create({
      data: {
        customerId: fx.users.customerB.id,
        unitId: fx.resources.b.unit1Id,
        totalAmount: 1_000_000,
        signedAt: new Date('2026-09-01'),
        status: ContractStatus.ACTIVE,
        companyId: fx.companies.bId,
      },
    });

    try {
      await request(testApp.app.getHttpServer())
        .post(`/v1/contracts/${bContract.id}/cancel`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({
          reason: 'Cross-tenant attack',
          retainedAmount: 0,
          refundAmount: 0,
        })
        .expect(404); // 404, not 403 — no existence leak

      // Company B's contract must remain ACTIVE
      const contract = await testApp.rawPrisma.contract.findUnique({ where: { id: bContract.id } });
      expect(contract?.status).toBe(ContractStatus.ACTIVE);
    } finally {
      await testApp.rawPrisma.contract.deleteMany({ where: { id: bContract.id } }).catch(() => void 0);
    }
  });

  it('D3-8: Company A admin cannot release-unit on Company B contract → 404', async () => {
    // Find a building in Company B to create the unit
    const buildingB = await testApp.rawPrisma.building.findFirst({
      where: { companyId: fx.companies.bId },
      select: { id: true },
    });
    if (!buildingB) throw new Error('D3-8: no building found for Company B');

    const bUnit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId: buildingB.id,
        code: 'D3-B-RELEASE-UNIT',
        type: '1BR',
        area: 80,
        price: 500_000,
        status: UnitStatus.SOLD,
        companyId: fx.companies.bId,
      },
    });
    const bContract = await testApp.rawPrisma.contract.create({
      data: {
        customerId: fx.users.customerB.id,
        unitId: bUnit.id,
        totalAmount: 500_000,
        signedAt: new Date('2026-09-01'),
        status: ContractStatus.CANCELLED,
        cancelledAt: new Date(),
        companyId: fx.companies.bId,
      },
    });
    await testApp.rawPrisma.contractCancellation.create({
      data: {
        contractId: bContract.id,
        cancelledById: fx.users.adminB.id,
        companyId: fx.companies.bId,
        reason: 'B company cancel',
        cancellationDate: new Date(),
        totalCollectedSnapshot: 0,
        retainedAmount: 0,
        refundAmount: 0,
        policySnapshot: {},
      },
    });

    try {
      await request(testApp.app.getHttpServer())
        .post(`/v1/contracts/${bContract.id}/release-unit`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .expect(404);

      // Unit must still be SOLD
      const unit = await testApp.rawPrisma.unit.findUnique({ where: { id: bUnit.id } });
      expect(unit?.status).toBe(UnitStatus.SOLD);
    } finally {
      await testApp.rawPrisma.contractCancellation.deleteMany({ where: { contractId: bContract.id } }).catch(() => void 0);
      await testApp.rawPrisma.contract.deleteMany({ where: { id: bContract.id } }).catch(() => void 0);
      await testApp.rawPrisma.unit.deleteMany({ where: { id: bUnit.id } }).catch(() => void 0);
    }
  });
});
