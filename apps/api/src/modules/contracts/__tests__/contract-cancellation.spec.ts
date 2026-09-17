/**
 * Step D3 — ContractCancellationService unit tests.
 *
 * All database calls are mocked with jest.fn(). Every test reads back the
 * arguments captured by the mocks to verify what was written — no test
 * returns early on a missing precondition; missing precondition = throw.
 *
 * Coverage:
 *  CC-U-1  cancel() ACTIVE contract, REQUIRES_APPROVAL, no commission/bonus →
 *          correct CC row data, correct installment bulk-cancel, AuditLog
 *  CC-U-2  cancel() with AUTO unit release → unit updated + UnitStatusHistory +
 *          CC.unitReleasedAt set inside transaction
 *  CC-U-3  cancel() CLAWBACK + commission PENDING → commission CANCELLED
 *  CC-U-4  cancel() CLAWBACK + commission in PAID payout → clawback overlay,
 *          commission status unchanged (Hard Rule 2)
 *  CC-U-5  cancel() CLAWBACK + bonusEntry PAID → clawback overlay (Hard Rule 2)
 *  CC-U-6  cancel() CLAWBACK + bonusEntry PENDING → bonusEntry CANCELLED
 *  CC-U-7  cancel() customer demotion: user→CLIENT + refresh tokens revoked
 *  CC-U-8  cancel() UNSIGNED contract — signedAt null, financial fields still stored
 *  CC-U-9  cancel() terminal guard: CANCELLED contract → ConflictException
 *  CC-U-10 cancel() 404 for nonexistent contract
 *  CC-U-11 cancel() operator-submitted amounts stored verbatim (not suggestion)
 *  CC-U-12 cancel() policySnapshot stores setting values, not operator overrides
 *  CC-U-13 releaseUnit() happy path: unit→AVAILABLE, UnitStatusHistory, unitReleasedAt
 *  CC-U-14 releaseUnit() 404 when contract not found
 *  CC-U-15 releaseUnit() ConflictException when contract is not CANCELLED
 *  CC-U-16 releaseUnit() ConflictException when unit already released
 *  CC-U-17 cancel() CLAWBACK + commission APPROVED + PROCESSING payout → overlay (PROCESSING = effectively paid)
 *  CC-U-18 cancel() CLAWBACK + commission APPROVED + APPROVED payout, no remaining → commission CANCELLED + payout CANCELLED
 *  CC-U-19 cancel() CLAWBACK + commission APPROVED + APPROVED payout, 1 remaining → payout DRAFT + recomputed totals
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { ContractCancellationService } from '../contract-cancellation.service';

// ── Shared test data ─────────────────────────────────────────────────────────

const COMPANY_ID = 'co-a-uuid';
const CONTRACT_ID = 'c1-uuid';
const UNIT_ID = 'u1-uuid';
const CUSTOMER_ID = 'cust-uuid';
const ACTOR_ID = 'admin-uuid';
const PLAN_ID = 'plan-uuid';
const COMMISSION_ID = 'bc1-uuid';
const PAYOUT_ID = 'po1-uuid';
const BONUS_ID = 'be1-uuid';

// Mock getRequiredCompanyId so it returns our fixed companyId
jest.mock('../../../common/tenant/tenant-context', () => ({
  getRequiredCompanyId: jest.fn(() => COMPANY_ID),
}));

// ── Prisma mock builder ───────────────────────────────────────────────────────

function buildTx() {
  return {
    contract: { update: jest.fn().mockResolvedValue({}) },
    installmentPlan: {
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    installment: { updateMany: jest.fn().mockResolvedValue({ count: 54 }) },
    brokerCommission: {
      update: jest.fn().mockResolvedValue({}),
      aggregate: jest.fn().mockResolvedValue({
        _count: { id: 0 },
        _sum: { grossAmount: null, taxAmount: null, withholdingAmount: null, netAmount: null },
      }),
    },
    brokerPayout: { update: jest.fn().mockResolvedValue({}) },
    bonusEntry: { update: jest.fn().mockResolvedValue({}) },
    unit: { update: jest.fn().mockResolvedValue({}) },
    unitStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    user: { update: jest.fn().mockResolvedValue({}) },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    contractCancellation: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'cc-uuid', ...args.data }),
      ),
      update: jest.fn().mockResolvedValue({ id: 'cc-uuid' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

function buildPrisma(overrides: {
  contract?: Record<string, unknown> | null;
  plan?: { id: string } | null;
  depositTotal?: number;
  commission?: Record<string, unknown> | null;
  bonusEntry?: Record<string, unknown> | null;
  unit?: { id: string; status: string } | null;
  cancellation?: Record<string, unknown> | null;
  tx?: ReturnType<typeof buildTx>;
}) {
  const tx = overrides.tx ?? buildTx();
  return {
    contract: {
      findFirst: jest.fn().mockResolvedValue(
        overrides.contract !== undefined
          ? overrides.contract
          : {
              id: CONTRACT_ID,
              status: ContractStatus.ACTIVE,
              unitId: UNIT_ID,
              customerId: CUSTOMER_ID,
              signedAt: new Date('2026-09-01'),
              totalAmount: new Prisma.Decimal(2_500_000),
            },
      ),
    },
    deposit: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(overrides.depositTotal ?? 325_000) },
      }),
    },
    installmentPlan: {
      findFirst: jest.fn().mockResolvedValue(
        overrides.plan !== undefined ? overrides.plan : { id: PLAN_ID },
      ),
    },
    brokerCommission: {
      findUnique: jest.fn().mockResolvedValue(overrides.commission !== undefined ? overrides.commission : null),
    },
    bonusEntry: {
      findUnique: jest.fn().mockResolvedValue(overrides.bonusEntry !== undefined ? overrides.bonusEntry : null),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.unit !== undefined ? overrides.unit : { id: UNIT_ID, status: 'SOLD' },
      ),
    },
    contractCancellation: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.cancellation !== undefined ? overrides.cancellation : null,
      ),
    },
    setting: {
      findMany: jest.fn().mockResolvedValue([
        { key: 'cancellation.bookingAmount.refundPct', value: 0 },
        { key: 'cancellation.contract.penaltyPct', value: 10 },
        { key: 'cancellation.unit.returnToAvailable', value: 'REQUIRES_APPROVAL' },
        { key: 'cancellation.customer.demoteToClient', value: false },
        { key: 'cancellation.brokerCommission.action', value: 'CLAWBACK' },
        { key: 'cancellation.salesBonus.action', value: 'CLAWBACK' },
        { key: 'cheque.bounced.installmentAction', value: 'REOPEN_AS_OVERDUE' },
        { key: 'cheque.bounced.penaltyAmount', value: 0 },
      ]),
    },
    $transaction: jest.fn().mockImplementation((fn: (tx: ReturnType<typeof buildTx>) => Promise<unknown>) => fn(tx)),
    _tx: tx,
  };
}

function buildNotifications() {
  return { sendToUser: jest.fn().mockResolvedValue(undefined) };
}

function buildSvc(prisma: ReturnType<typeof buildPrisma>) {
  const { CancellationPolicyService } = jest.requireActual('../cancellation-policy.service') as typeof import('../cancellation-policy.service');
  const policy = new CancellationPolicyService(prisma as never);
  return new ContractCancellationService(prisma as never, policy, buildNotifications() as never);
}

const BASE_INPUT = {
  reason: 'Mutual agreement',
  retainedAmount: 50_000,
  refundAmount: 275_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// cancel() — happy path
// ─────────────────────────────────────────────────────────────────────────────

describe('ContractCancellationService.cancel()', () => {
  it('CC-U-1: ACTIVE contract with no commission/bonus — CC row created with correct data', async () => {
    const prisma = buildPrisma({});
    const svc = buildSvc(prisma);

    const result = await svc.cancel(CONTRACT_ID, BASE_INPUT, ACTOR_ID);

    // ContractCancellation row holds operator amounts verbatim
    const ccCreateCall = prisma._tx.contractCancellation.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    if (!ccCreateCall) throw new Error('contractCancellation.create was not called');

    const data = ccCreateCall.data;
    expect(String(data['retainedAmount'])).toBe('50000');
    expect(String(data['refundAmount'])).toBe('275000');
    expect(data['reason']).toBe('Mutual agreement');
    expect(data['contractId']).toBe(CONTRACT_ID);
    expect(data['companyId']).toBe(COMPANY_ID);
    expect(data['totalCollectedSnapshot']).toBeInstanceOf(Prisma.Decimal);

    // Contract marked CANCELLED
    const contractUpdate = prisma._tx.contract.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    if (!contractUpdate) throw new Error('contract.update was not called');
    expect(contractUpdate.data['status']).toBe('CANCELLED');
    expect(contractUpdate.data['cancelledAt']).toBeInstanceOf(Date);

    // InstallmentPlan cancelled
    expect(prisma._tx.installmentPlan.update).toHaveBeenCalled();

    // Installments bulk-cancelled
    const instUpdate = prisma._tx.installment.updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown>; where: Record<string, unknown> };
    if (!instUpdate) throw new Error('installment.updateMany was not called');
    expect(instUpdate.data['status']).toBe('CANCELLED');
    expect(instUpdate.where).toMatchObject({ planId: PLAN_ID });

    // AuditLog written with correct action
    const auditCall = prisma._tx.auditLog.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    if (!auditCall) throw new Error('auditLog.create was not called');
    expect(auditCall.data['action']).toBe('contract.cancelled');
    expect(auditCall.data['entityId']).toBe(CONTRACT_ID);

    // policySnapshot in AuditLog payload contains setting values
    const payload = auditCall.data['after'] as Record<string, unknown>;
    expect(payload['policySnapshot']).toMatchObject({
      penaltyPct: 10,
      bookingRefundPct: 0,
      unitRelease: 'REQUIRES_APPROVAL',
    });

    expect(result).toBeDefined();
  });

  it('CC-U-2: AUTO unit release — unit updated + UnitStatusHistory created + unitReleasedAt set', async () => {
    const prisma = buildPrisma({});
    const svc = buildSvc(prisma);

    await svc.cancel(CONTRACT_ID, { ...BASE_INPUT, unitReleaseOverride: 'AUTO' }, ACTOR_ID);

    const unitUpdate = prisma._tx.unit.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    if (!unitUpdate) throw new Error('unit.update was not called for AUTO release');
    expect(unitUpdate.data['status']).toBe('AVAILABLE');

    expect(prisma._tx.unitStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: UNIT_ID,
          newStatus: 'AVAILABLE',
          oldStatus: 'SOLD',
        }),
      }),
    );

    // CC row has unitReleasedAt set
    const ccData = (prisma._tx.contractCancellation.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(ccData['unitReleasedAt']).toBeInstanceOf(Date);
  });

  it('CC-U-3: CLAWBACK + commission PENDING (no payout) → commission CANCELLED', async () => {
    const prisma = buildPrisma({
      commission: {
        id: COMMISSION_ID,
        status: 'PENDING',
        clawbackStatus: null,
        payoutId: null,
        payout: null,
      },
    });
    const svc = buildSvc(prisma);

    await svc.cancel(CONTRACT_ID, BASE_INPUT, ACTOR_ID);

    const bcUpdate = prisma._tx.brokerCommission.update.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!bcUpdate) throw new Error('brokerCommission.update was not called');
    expect(bcUpdate.where['id']).toBe(COMMISSION_ID);
    expect(bcUpdate.data['status']).toBe('CANCELLED');
    // Hard Rule 2: no clawback overlay applied
    expect(bcUpdate.data['clawbackStatus']).toBeUndefined();
  });

  it('CC-U-4: CLAWBACK + commission in PAID payout → clawback overlay; status unchanged (Hard Rule 2)', async () => {
    const prisma = buildPrisma({
      commission: {
        id: COMMISSION_ID,
        status: 'APPROVED',
        clawbackStatus: null,
        payoutId: PAYOUT_ID,
        payout: { status: 'PAID' },
      },
    });
    const svc = buildSvc(prisma);

    await svc.cancel(CONTRACT_ID, { ...BASE_INPUT, clawbackReason: 'Commission recovery' }, ACTOR_ID);

    const bcUpdate = prisma._tx.brokerCommission.update.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!bcUpdate) throw new Error('brokerCommission.update was not called');
    expect(bcUpdate.where['id']).toBe(COMMISSION_ID);
    // Hard Rule 2: status NEVER changed
    expect(bcUpdate.data['status']).toBeUndefined();
    // Clawback overlay applied
    expect(bcUpdate.data['clawbackStatus']).toBe('OUTSTANDING');
    expect(bcUpdate.data['clawbackReason']).toBe('Commission recovery');
    expect(bcUpdate.data['clawbackAt']).toBeInstanceOf(Date);
    expect(bcUpdate.data['clawbackById']).toBe(ACTOR_ID);

    // AuditLog payload includes commission clawback id
    const payload = (prisma._tx.auditLog.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data['after'] as Record<string, unknown>;
    expect(payload['commissionClawbackIds']).toContain(COMMISSION_ID);
  });

  it('CC-U-5: CLAWBACK + bonusEntry PAID → clawback overlay; status stays PAID (Hard Rule 2)', async () => {
    const prisma = buildPrisma({
      bonusEntry: { id: BONUS_ID, status: 'PAID', clawbackStatus: null },
    });
    const svc = buildSvc(prisma);

    await svc.cancel(CONTRACT_ID, BASE_INPUT, ACTOR_ID);

    const beUpdate = prisma._tx.bonusEntry.update.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!beUpdate) throw new Error('bonusEntry.update was not called');
    expect(beUpdate.where['id']).toBe(BONUS_ID);
    expect(beUpdate.data['status']).toBeUndefined(); // Hard Rule 2: not changed
    expect(beUpdate.data['clawbackStatus']).toBe('OUTSTANDING');

    const payload = (prisma._tx.auditLog.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data['after'] as Record<string, unknown>;
    expect(payload['bonusClawbackIds']).toContain(BONUS_ID);
  });

  it('CC-U-6: CLAWBACK + bonusEntry PENDING → bonusEntry CANCELLED', async () => {
    const prisma = buildPrisma({
      bonusEntry: { id: BONUS_ID, status: 'PENDING', clawbackStatus: null },
    });
    const svc = buildSvc(prisma);

    await svc.cancel(CONTRACT_ID, BASE_INPUT, ACTOR_ID);

    const beUpdate = prisma._tx.bonusEntry.update.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!beUpdate) throw new Error('bonusEntry.update was not called');
    expect(beUpdate.where['id']).toBe(BONUS_ID);
    expect(beUpdate.data['status']).toBe('CANCELLED');
    expect(beUpdate.data['clawbackStatus']).toBeUndefined();
  });

  it('CC-U-7: demoteCustomerOverride=true → user→CLIENT + refresh tokens revoked', async () => {
    const prisma = buildPrisma({});
    const svc = buildSvc(prisma);

    await svc.cancel(CONTRACT_ID, { ...BASE_INPUT, demoteCustomerOverride: true }, ACTOR_ID);

    const userUpdate = prisma._tx.user.update.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!userUpdate) throw new Error('user.update was not called');
    expect(userUpdate.where['id']).toBe(CUSTOMER_ID);
    expect(userUpdate.data['role']).toBe('CLIENT');

    const rtUpdate = prisma._tx.refreshToken.updateMany.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!rtUpdate) throw new Error('refreshToken.updateMany was not called');
    expect(rtUpdate.where['userId']).toBe(CUSTOMER_ID);
    expect(rtUpdate.data['revokedAt']).toBeInstanceOf(Date);

    // CC row has customerDemotedAt set
    const ccData = (prisma._tx.contractCancellation.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(ccData['customerDemotedAt']).toBeInstanceOf(Date);
  });

  it('CC-U-8: UNSIGNED contract (signedAt=null) — CC row still created with financial amounts', async () => {
    const prisma = buildPrisma({
      contract: {
        id: CONTRACT_ID,
        status: ContractStatus.UNSIGNED,
        unitId: UNIT_ID,
        customerId: CUSTOMER_ID,
        signedAt: null,
        totalAmount: new Prisma.Decimal(1_000_000),
      },
      depositTotal: 0,
    });
    const svc = buildSvc(prisma);

    await svc.cancel(CONTRACT_ID, { ...BASE_INPUT, retainedAmount: 0, refundAmount: 0 }, ACTOR_ID);

    const ccData = (prisma._tx.contractCancellation.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(ccData['retainedAmount']).toBeDefined();
    expect(String(ccData['retainedAmount'])).toBe('0');
    // AuditLog before.status = UNSIGNED
    const auditBefore = (prisma._tx.auditLog.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data['before'] as Record<string, unknown>;
    expect(auditBefore['status']).toBe('UNSIGNED');
    expect(auditBefore['signedAt']).toBeNull();
  });

  it('CC-U-9: CANCELLED contract → ConflictException (terminal guard)', async () => {
    const prisma = buildPrisma({
      contract: {
        id: CONTRACT_ID,
        status: ContractStatus.CANCELLED,
        unitId: UNIT_ID,
        customerId: CUSTOMER_ID,
        signedAt: null,
        totalAmount: new Prisma.Decimal(0),
      },
    });
    const svc = buildSvc(prisma);

    await expect(svc.cancel(CONTRACT_ID, BASE_INPUT, ACTOR_ID)).rejects.toThrow(ConflictException);
  });

  it('CC-U-10: nonexistent contract → NotFoundException', async () => {
    const prisma = buildPrisma({ contract: null });
    const svc = buildSvc(prisma);

    await expect(svc.cancel(CONTRACT_ID, BASE_INPUT, ACTOR_ID)).rejects.toThrow(NotFoundException);
  });

  it('CC-U-11: operator-submitted amounts stored verbatim — differ from suggestion', async () => {
    // Suggestion would say retained=55,000 / refund=270,000.
    // Operator submits retained=99,000 / refund=226,000.
    const prisma = buildPrisma({ depositTotal: 325_000 });
    const svc = buildSvc(prisma);

    await svc.cancel(
      CONTRACT_ID,
      { ...BASE_INPUT, retainedAmount: 99_000, refundAmount: 226_000 },
      ACTOR_ID,
    );

    const ccData = (prisma._tx.contractCancellation.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(String(ccData['retainedAmount'])).toBe('99000');
    expect(String(ccData['refundAmount'])).toBe('226000');
  });

  it('CC-U-17: CLAWBACK + commission APPROVED in PROCESSING payout → clawback overlay (PROCESSING = effectively paid)', async () => {
    const prisma = buildPrisma({
      commission: {
        id: COMMISSION_ID,
        status: 'APPROVED',
        clawbackStatus: null,
        payoutId: PAYOUT_ID,
        payout: { status: 'PROCESSING' },
      },
    });
    const svc = buildSvc(prisma);

    await svc.cancel(CONTRACT_ID, { ...BASE_INPUT, clawbackReason: 'Commission recovery' }, ACTOR_ID);

    const bcUpdate = prisma._tx.brokerCommission.update.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!bcUpdate) throw new Error('brokerCommission.update was not called');
    // Overlay path: status unchanged, clawbackStatus set
    expect(bcUpdate.data['status']).toBeUndefined();
    expect(bcUpdate.data['clawbackStatus']).toBe('OUTSTANDING');
    // Payout side-effects must NOT run in overlay path
    expect(prisma._tx.brokerPayout.update).not.toHaveBeenCalled();
    expect(prisma._tx.brokerCommission.aggregate).not.toHaveBeenCalled();
  });

  it('CC-U-18: CLAWBACK + commission APPROVED in APPROVED payout, no remaining → commission CANCELLED + payout CANCELLED', async () => {
    const prisma = buildPrisma({
      commission: {
        id: COMMISSION_ID,
        status: 'APPROVED',
        clawbackStatus: null,
        payoutId: PAYOUT_ID,
        payout: { status: 'APPROVED' },
      },
    });
    const svc = buildSvc(prisma);

    await svc.cancel(CONTRACT_ID, BASE_INPUT, ACTOR_ID);

    // Commission cancelled and removed from payout
    const bcUpdate = prisma._tx.brokerCommission.update.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!bcUpdate) throw new Error('brokerCommission.update was not called');
    expect(bcUpdate.data['status']).toBe('CANCELLED');
    expect(bcUpdate.data['payoutId']).toBeNull();

    // Aggregate was called to count remaining commissions
    expect(prisma._tx.brokerCommission.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { payoutId: PAYOUT_ID } }),
    );

    // Default mock returns _count.id=0 → payout CANCELLED
    const payoutUpdate = prisma._tx.brokerPayout.update.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!payoutUpdate) throw new Error('brokerPayout.update was not called');
    expect(payoutUpdate.where['id']).toBe(PAYOUT_ID);
    expect(payoutUpdate.data['status']).toBe('CANCELLED');
    expect(payoutUpdate.data['cancelledAt']).toBeInstanceOf(Date);
    expect(payoutUpdate.data['cancelledById']).toBe(ACTOR_ID);
  });

  it('CC-U-19: CLAWBACK + commission APPROVED in APPROVED payout, 1 remaining → payout DRAFT + recomputed totals', async () => {
    const tx = buildTx();
    (tx.brokerCommission.aggregate as jest.Mock).mockResolvedValue({
      _count: { id: 1 },
      _sum: {
        grossAmount: new Prisma.Decimal(30_000),
        taxAmount: new Prisma.Decimal(3_000),
        withholdingAmount: new Prisma.Decimal(1_500),
        netAmount: new Prisma.Decimal(25_500),
      },
    });
    const prisma = buildPrisma({
      commission: {
        id: COMMISSION_ID,
        status: 'APPROVED',
        clawbackStatus: null,
        payoutId: PAYOUT_ID,
        payout: { status: 'APPROVED' },
      },
      tx,
    });
    const svc = buildSvc(prisma);

    await svc.cancel(CONTRACT_ID, BASE_INPUT, ACTOR_ID);

    // Commission cancelled
    const bcUpdate = tx.brokerCommission.update.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!bcUpdate) throw new Error('brokerCommission.update was not called');
    expect(bcUpdate.data['status']).toBe('CANCELLED');
    expect(bcUpdate.data['payoutId']).toBeNull();

    // Payout reverted to DRAFT with recomputed totals
    const payoutUpdate = tx.brokerPayout.update.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    if (!payoutUpdate) throw new Error('brokerPayout.update was not called');
    expect(payoutUpdate.where['id']).toBe(PAYOUT_ID);
    expect(payoutUpdate.data['status']).toBe('DRAFT');
    expect(String(payoutUpdate.data['totalGross'])).toBe('30000');
    expect(String(payoutUpdate.data['totalTax'])).toBe('3000');
    expect(String(payoutUpdate.data['totalWithholding'])).toBe('1500');
    expect(String(payoutUpdate.data['totalNet'])).toBe('25500');
  });

  it('CC-U-12: policySnapshot stores current setting values, not operator overrides', async () => {
    // Operator sets unitReleaseOverride=AUTO and commissionActionOverride=RETAIN
    // but policySnapshot must still record the TENANT setting (REQUIRES_APPROVAL / CLAWBACK).
    const prisma = buildPrisma({});
    const svc = buildSvc(prisma);

    await svc.cancel(
      CONTRACT_ID,
      { ...BASE_INPUT, unitReleaseOverride: 'AUTO', commissionActionOverride: 'RETAIN' },
      ACTOR_ID,
    );

    const ccData = (prisma._tx.contractCancellation.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    const snap = ccData['policySnapshot'] as Record<string, unknown>;
    // policySnapshot = settings values, not overrides
    expect(snap['unitRelease']).toBe('REQUIRES_APPROVAL');
    expect(snap['commissionAction']).toBe('CLAWBACK');
    // Override stored separately on the CC row
    expect(ccData['unitReleaseOverride']).toBe('AUTO');
    expect(ccData['commissionActionOverride']).toBe('RETAIN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// releaseUnit()
// ─────────────────────────────────────────────────────────────────────────────

describe('ContractCancellationService.releaseUnit()', () => {
  const cancelledContract = {
    id: CONTRACT_ID,
    status: ContractStatus.CANCELLED,
    unitId: UNIT_ID,
  };

  it('CC-U-13: happy path — unit→AVAILABLE, UnitStatusHistory created, unitReleasedAt set', async () => {
    const prisma = buildPrisma({
      contract: cancelledContract,
      cancellation: { id: 'cc-uuid', unitReleasedAt: null },
    });
    const svc = buildSvc(prisma);

    await svc.releaseUnit(CONTRACT_ID, ACTOR_ID);

    const unitUpdate = prisma._tx.unit.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    if (!unitUpdate) throw new Error('unit.update was not called');
    expect(unitUpdate.data['status']).toBe('AVAILABLE');

    expect(prisma._tx.unitStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: UNIT_ID,
          newStatus: 'AVAILABLE',
          oldStatus: 'SOLD',
        }),
      }),
    );

    const ccUpdate = prisma._tx.contractCancellation.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    if (!ccUpdate) throw new Error('contractCancellation.update was not called');
    expect(ccUpdate.data['unitReleasedAt']).toBeInstanceOf(Date);

    expect(prisma._tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'contract.unit-released' }),
      }),
    );
  });

  it('CC-U-14: nonexistent contract → NotFoundException', async () => {
    const prisma = buildPrisma({ contract: null });
    const svc = buildSvc(prisma);

    await expect(svc.releaseUnit(CONTRACT_ID, ACTOR_ID)).rejects.toThrow(NotFoundException);
  });

  it('CC-U-15: contract is not CANCELLED → ConflictException', async () => {
    const prisma = buildPrisma({
      contract: { ...cancelledContract, status: ContractStatus.ACTIVE },
    });
    const svc = buildSvc(prisma);

    await expect(svc.releaseUnit(CONTRACT_ID, ACTOR_ID)).rejects.toThrow(ConflictException);
  });

  it('CC-U-16: unit already released → ConflictException', async () => {
    const prisma = buildPrisma({
      contract: cancelledContract,
      cancellation: { id: 'cc-uuid', unitReleasedAt: new Date('2026-09-14') },
    });
    const svc = buildSvc(prisma);

    await expect(svc.releaseUnit(CONTRACT_ID, ACTOR_ID)).rejects.toThrow(ConflictException);
  });
});
