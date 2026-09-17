/**
 * Step D4 — ClawbackResolutionService unit tests.
 *
 * All database calls are mocked with jest.fn(). Every test reads back the
 * arguments captured by the mocks to verify what was written — no test
 * returns early on a missing precondition; missing precondition = throw.
 *
 * Coverage (commission path):
 *  D4-C-1  OUTSTANDING → COLLECTED (full amount): clawbackStatus=COLLECTED,
 *           collected amount/reference/method stored, commission.status unchanged
 *  D4-C-2  OUTSTANDING → PARTIALLY_COLLECTED (partial): NOT marked COLLECTED;
 *           clawbackCollectedAmount accumulates
 *  D4-C-3  PARTIALLY_COLLECTED → COLLECTED on second collect (accumulated total ≥ full)
 *  D4-C-4  OUTSTANDING → WAIVED: waiveReason stored in clawbackWaiveReason (not clawbackReason)
 *  D4-C-5  COLLECTED → collect → ConflictException (terminal)
 *  D4-C-6  WAIVED → waive → ConflictException (terminal)
 *  D4-C-7  clawbackStatus null → ConflictException on collect
 *  D4-C-8  clawbackStatus null → ConflictException on waive
 *  D4-C-9  commission not found → NotFoundException on collect
 *  D4-C-10 commission not found → NotFoundException on waive
 *  D4-C-11 Hard Rule 2: commission.status unchanged in every path
 *
 * Coverage (BonusEntry path — simpler, no payout dimension):
 *  D4-B-1  OUTSTANDING → COLLECTED (full): bonusEntry.status unchanged
 *  D4-B-2  OUTSTANDING → PARTIALLY_COLLECTED (partial)
 *  D4-B-3  OUTSTANDING → WAIVED: waiveReason stored separately
 *  D4-B-4  COLLECTED → collect → ConflictException (terminal)
 *  D4-B-5  clawbackStatus null → ConflictException
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { BonusEntryStatus, BrokerCommissionStatus, ClawbackStatus, PaymentMethod, Prisma } from '@prisma/client';
import { ClawbackResolutionService } from '../clawback-resolution.service';

jest.mock('../../../common/tenant/tenant-context', () => ({
  getRequiredCompanyId: jest.fn(() => 'co-a-uuid'),
}));

const COMPANY_ID = 'co-a-uuid';
const COMMISSION_ID = 'bc1-uuid';
const BONUS_ID = 'be1-uuid';
const ACTOR = { sub: 'admin-uuid', role: 'ADMIN', companyId: COMPANY_ID } as any;

const NET_AMOUNT = new Prisma.Decimal(75_000);
const BONUS_AMOUNT = new Prisma.Decimal(20_000);

function buildPrisma(overrides: Record<string, unknown> = {}) {
  const txMock = {
    brokerCommission: { update: jest.fn().mockResolvedValue({}) },
    bonusEntry: { update: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    brokerCommission: {
      findFirst: jest.fn(),
    },
    bonusEntry: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(txMock),
    ),
    _tx: txMock,
    ...overrides,
  };
}

function makeCommission(
  clawbackStatus: ClawbackStatus | null,
  clawbackCollectedAmount: Prisma.Decimal | null = null,
) {
  return {
    id: COMMISSION_ID,
    status: BrokerCommissionStatus.APPROVED,
    clawbackStatus,
    clawbackCollectedAmount,
    netAmount: NET_AMOUNT,
  };
}

function makeBonus(
  clawbackStatus: ClawbackStatus | null,
  clawbackCollectedAmount: Prisma.Decimal | null = null,
) {
  return {
    id: BONUS_ID,
    status: BonusEntryStatus.PAID,
    clawbackStatus,
    clawbackCollectedAmount,
    amount: BONUS_AMOUNT,
  };
}

// ── Commission tests ──────────────────────────────────────────────────────────

describe('ClawbackResolutionService — BrokerCommission', () => {
  let svc: ClawbackResolutionService;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    svc = new ClawbackResolutionService(prisma as any);
  });

  it('D4-C-1: OUTSTANDING → COLLECTED when full amount supplied', async () => {
    prisma.brokerCommission.findFirst.mockResolvedValue(
      makeCommission(ClawbackStatus.OUTSTANDING),
    );

    await svc.collectCommission(
      COMMISSION_ID,
      { amount: 75_000, paymentMethod: PaymentMethod.BANK_TRANSFER, reference: 'REF-001' },
      ACTOR,
    );

    const updateArgs = prisma._tx.brokerCommission.update.mock.calls[0][0];
    expect(updateArgs.data.clawbackStatus).toBe(ClawbackStatus.COLLECTED);
    expect(Number(updateArgs.data.clawbackCollectedAmount)).toBe(75_000);
    expect(updateArgs.data.clawbackCollectedReference).toBe('REF-001');
    expect(updateArgs.data.clawbackCollectedPaymentMethod).toBe(PaymentMethod.BANK_TRANSFER);
    // Hard Rule 2: status field is NOT in the update data
    expect(updateArgs.data.status).toBeUndefined();
  });

  it('D4-C-2: OUTSTANDING → PARTIALLY_COLLECTED for partial amount (not COLLECTED)', async () => {
    prisma.brokerCommission.findFirst.mockResolvedValue(
      makeCommission(ClawbackStatus.OUTSTANDING),
    );

    await svc.collectCommission(
      COMMISSION_ID,
      { amount: 50_000, paymentMethod: PaymentMethod.BANK_TRANSFER },
      ACTOR,
    );

    const updateArgs = prisma._tx.brokerCommission.update.mock.calls[0][0];
    expect(updateArgs.data.clawbackStatus).toBe(ClawbackStatus.PARTIALLY_COLLECTED);
    expect(Number(updateArgs.data.clawbackCollectedAmount)).toBe(50_000);
    // Must NOT be COLLECTED
    expect(updateArgs.data.clawbackStatus).not.toBe(ClawbackStatus.COLLECTED);
    expect(updateArgs.data.status).toBeUndefined();
  });

  it('D4-C-3: PARTIALLY_COLLECTED → COLLECTED on second collect (accumulated total ≥ full)', async () => {
    prisma.brokerCommission.findFirst.mockResolvedValue(
      makeCommission(ClawbackStatus.PARTIALLY_COLLECTED, new Prisma.Decimal(50_000)),
    );

    await svc.collectCommission(
      COMMISSION_ID,
      { amount: 25_000, paymentMethod: PaymentMethod.CHEQUE },
      ACTOR,
    );

    const updateArgs = prisma._tx.brokerCommission.update.mock.calls[0][0];
    expect(updateArgs.data.clawbackStatus).toBe(ClawbackStatus.COLLECTED);
    expect(Number(updateArgs.data.clawbackCollectedAmount)).toBe(75_000);
    expect(updateArgs.data.status).toBeUndefined();
  });

  it('D4-C-4: OUTSTANDING → WAIVED with waiveReason stored in clawbackWaiveReason (not clawbackReason)', async () => {
    prisma.brokerCommission.findFirst.mockResolvedValue(
      makeCommission(ClawbackStatus.OUTSTANDING),
    );

    const WAIVE_REASON = 'Financial hardship acknowledged by management';
    await svc.waiveCommission(COMMISSION_ID, { reason: WAIVE_REASON }, ACTOR);

    const updateArgs = prisma._tx.brokerCommission.update.mock.calls[0][0];
    expect(updateArgs.data.clawbackStatus).toBe(ClawbackStatus.WAIVED);
    expect(updateArgs.data.clawbackWaiveReason).toBe(WAIVE_REASON);
    // clawbackReason is the cancellation reason — it must NOT be set here
    expect(updateArgs.data.clawbackReason).toBeUndefined();
    expect(updateArgs.data.status).toBeUndefined();
  });

  it('D4-C-5: COLLECTED → collect → ConflictException (terminal)', async () => {
    prisma.brokerCommission.findFirst.mockResolvedValue(
      makeCommission(ClawbackStatus.COLLECTED, new Prisma.Decimal(75_000)),
    );

    await expect(
      svc.collectCommission(
        COMMISSION_ID,
        { amount: 1, paymentMethod: PaymentMethod.CASH },
        ACTOR,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma._tx.brokerCommission.update).not.toHaveBeenCalled();
  });

  it('D4-C-6: WAIVED → waive → ConflictException (terminal)', async () => {
    prisma.brokerCommission.findFirst.mockResolvedValue(
      makeCommission(ClawbackStatus.WAIVED),
    );

    await expect(
      svc.waiveCommission(COMMISSION_ID, { reason: 'Another reason' }, ACTOR),
    ).rejects.toThrow(ConflictException);

    expect(prisma._tx.brokerCommission.update).not.toHaveBeenCalled();
  });

  it('D4-C-7: clawbackStatus null → ConflictException on collect', async () => {
    prisma.brokerCommission.findFirst.mockResolvedValue(makeCommission(null));

    await expect(
      svc.collectCommission(
        COMMISSION_ID,
        { amount: 1_000, paymentMethod: PaymentMethod.BANK_TRANSFER },
        ACTOR,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('D4-C-8: clawbackStatus null → ConflictException on waive', async () => {
    prisma.brokerCommission.findFirst.mockResolvedValue(makeCommission(null));

    await expect(
      svc.waiveCommission(COMMISSION_ID, { reason: 'reason' }, ACTOR),
    ).rejects.toThrow(ConflictException);
  });

  it('D4-C-9: commission not found → NotFoundException on collect', async () => {
    prisma.brokerCommission.findFirst.mockResolvedValue(null);

    await expect(
      svc.collectCommission(
        'nonexistent',
        { amount: 1_000, paymentMethod: PaymentMethod.BANK_TRANSFER },
        ACTOR,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('D4-C-10: commission not found → NotFoundException on waive', async () => {
    prisma.brokerCommission.findFirst.mockResolvedValue(null);

    await expect(
      svc.waiveCommission('nonexistent', { reason: 'reason' }, ACTOR),
    ).rejects.toThrow(NotFoundException);
  });

  it('D4-C-11: Hard Rule 2 — commission.status never set in any path', async () => {
    // Collect path
    prisma.brokerCommission.findFirst.mockResolvedValue(
      makeCommission(ClawbackStatus.OUTSTANDING),
    );
    await svc.collectCommission(
      COMMISSION_ID,
      { amount: 75_000, paymentMethod: PaymentMethod.BANK_TRANSFER },
      ACTOR,
    );
    let args = prisma._tx.brokerCommission.update.mock.calls[0][0];
    expect('status' in args.data).toBe(false);

    // Waive path — rebuild to reset mocks
    const prisma2 = buildPrisma();
    const svc2 = new ClawbackResolutionService(prisma2 as any);
    prisma2.brokerCommission.findFirst.mockResolvedValue(
      makeCommission(ClawbackStatus.OUTSTANDING),
    );
    await svc2.waiveCommission(COMMISSION_ID, { reason: 'waive reason' }, ACTOR);
    args = prisma2._tx.brokerCommission.update.mock.calls[0][0];
    expect('status' in args.data).toBe(false);
  });
});

// ── BonusEntry tests ──────────────────────────────────────────────────────────

describe('ClawbackResolutionService — BonusEntry', () => {
  let svc: ClawbackResolutionService;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    svc = new ClawbackResolutionService(prisma as any);
  });

  it('D4-B-1: OUTSTANDING → COLLECTED (full amount); bonusEntry.status unchanged', async () => {
    prisma.bonusEntry.findFirst.mockResolvedValue(
      makeBonus(ClawbackStatus.OUTSTANDING),
    );

    await svc.collectBonus(
      BONUS_ID,
      { amount: 20_000, paymentMethod: PaymentMethod.BANK_TRANSFER, reference: 'BNS-REF-001' },
      ACTOR,
    );

    const updateArgs = prisma._tx.bonusEntry.update.mock.calls[0][0];
    expect(updateArgs.data.clawbackStatus).toBe(ClawbackStatus.COLLECTED);
    expect(Number(updateArgs.data.clawbackCollectedAmount)).toBe(20_000);
    expect(updateArgs.data.clawbackCollectedReference).toBe('BNS-REF-001');
    // Hard Rule 2: bonusEntry.status never set
    expect(updateArgs.data.status).toBeUndefined();
  });

  it('D4-B-2: OUTSTANDING → PARTIALLY_COLLECTED (partial repayment)', async () => {
    prisma.bonusEntry.findFirst.mockResolvedValue(
      makeBonus(ClawbackStatus.OUTSTANDING),
    );

    await svc.collectBonus(
      BONUS_ID,
      { amount: 12_000, paymentMethod: PaymentMethod.CASH },
      ACTOR,
    );

    const updateArgs = prisma._tx.bonusEntry.update.mock.calls[0][0];
    expect(updateArgs.data.clawbackStatus).toBe(ClawbackStatus.PARTIALLY_COLLECTED);
    expect(Number(updateArgs.data.clawbackCollectedAmount)).toBe(12_000);
    expect(updateArgs.data.status).toBeUndefined();
  });

  it('D4-B-3: OUTSTANDING → WAIVED; clawbackWaiveReason stored, clawbackReason untouched', async () => {
    prisma.bonusEntry.findFirst.mockResolvedValue(
      makeBonus(ClawbackStatus.OUTSTANDING),
    );

    const WAIVE_REASON = 'Management approved full waiver';
    await svc.waiveBonus(BONUS_ID, { reason: WAIVE_REASON }, ACTOR);

    const updateArgs = prisma._tx.bonusEntry.update.mock.calls[0][0];
    expect(updateArgs.data.clawbackStatus).toBe(ClawbackStatus.WAIVED);
    expect(updateArgs.data.clawbackWaiveReason).toBe(WAIVE_REASON);
    expect(updateArgs.data.clawbackReason).toBeUndefined();
    expect(updateArgs.data.status).toBeUndefined();
  });

  it('D4-B-4: COLLECTED → collect → ConflictException (terminal)', async () => {
    prisma.bonusEntry.findFirst.mockResolvedValue(
      makeBonus(ClawbackStatus.COLLECTED, new Prisma.Decimal(20_000)),
    );

    await expect(
      svc.collectBonus(BONUS_ID, { amount: 1, paymentMethod: PaymentMethod.CASH }, ACTOR),
    ).rejects.toThrow(ConflictException);

    expect(prisma._tx.bonusEntry.update).not.toHaveBeenCalled();
  });

  it('D4-B-5: clawbackStatus null → ConflictException on collect', async () => {
    prisma.bonusEntry.findFirst.mockResolvedValue(makeBonus(null));

    await expect(
      svc.collectBonus(BONUS_ID, { amount: 1_000, paymentMethod: PaymentMethod.BANK_TRANSFER }, ACTOR),
    ).rejects.toThrow(ConflictException);
  });
});
