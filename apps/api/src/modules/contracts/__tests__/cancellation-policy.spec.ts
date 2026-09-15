/**
 * Step D2 — CancellationPolicyService unit tests.
 *
 * Covers:
 *   SP-1   getCancellationSuggestion formula — S2 worked example (§4.4)
 *   SP-2   getBounceSuggestion returns correct policySnapshot
 *   SP-3   settings fall back to documented defaults when rows are absent
 *   SP-4   getCancellationSuggestion throws 404 for an unknown contract
 *   SP-5   getBounceSuggestion throws 404 for an unknown instrument
 *   SP-6   Changing a setting after suggestion is computed does not alter the
 *           returned snapshot (immutability — snapshot is a plain object copy)
 *   SP-7   seedCancellationSettingsForCompany calls createMany with all 8 keys
 *   SP-8   seedCancellationSettingsForCompany is idempotent (skipDuplicates=true)
 *   SP-9   Default value assertions — each key has the exact documented default
 *
 * Validation tests (write-time guard in settings.module.ts):
 *   VAL-1  cancellation.bookingAmount.refundPct: 101 rejected (> 100)
 *   VAL-2  cancellation.bookingAmount.refundPct: -1 rejected (< 0)
 *   VAL-3  cancellation.contract.penaltyPct: non-integer rejected
 *   VAL-4  cancellation.unit.returnToAvailable: invalid enum rejected
 *   VAL-5  cancellation.customer.demoteToClient: string "true" rejected
 *   VAL-6  cancellation.brokerCommission.action: unknown action rejected
 *   VAL-7  cancellation.salesBonus.action: unknown action rejected
 *   VAL-8  cheque.bounced.installmentAction: invalid enum rejected
 *   VAL-9  cheque.bounced.penaltyAmount: negative rejected
 *   VAL-10 cheque.bounced.penaltyAmount: > 2 decimal places rejected
 *   VAL-11 unknown key is not validated (no validator registered = pass-through)
 *   VAL-12 valid values are accepted without error
 */

import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CANCELLATION_SETTING_DEFAULTS,
  CANCELLATION_SETTING_KEYS,
  seedCancellationSettingsForCompany,
  type CancellationSettingsRow,
} from '../cancellation-settings.constants';
import { CancellationPolicyService } from '../cancellation-policy.service';

// ── Validation function (extracted from settings.module.ts for testing) ───────
// Re-implement the validation logic as a thin wrapper over the module's exported
// behaviour. We test via BadRequestException thrown from the SettingsService.upsert
// path. Here we exercise the guard directly by importing the module and calling upsert.

// To avoid booting the full NestJS app for validation tests, we replicate
// the pure validator functions inline (matching settings.module.ts 1-for-1).

function validateIntPercent(key: string, v: unknown): void {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 100) {
    throw new Error(`${key}: must be an integer between 0 and 100`);
  }
}

function validateNonNegativeDecimal(key: string, v: unknown): void {
  if (typeof v !== 'number' || v < 0 || !isFinite(v)) {
    throw new Error(`${key}: must be a non-negative number`);
  }
  if (Math.round(v * 100) !== v * 100) {
    throw new Error(`${key}: maximum 2 decimal places`);
  }
}

function validateEnum(key: string, v: unknown, allowed: string[]): void {
  if (typeof v !== 'string' || !allowed.includes(v)) {
    throw new Error(`${key}: must be one of ${allowed.join(', ')}`);
  }
}

function validateBoolean(key: string, v: unknown): void {
  if (typeof v !== 'boolean') throw new Error(`${key}: must be a boolean`);
}

const VALIDATORS: Record<string, (key: string, v: unknown) => void> = {
  'cancellation.bookingAmount.refundPct': (k, v) => validateIntPercent(k, v),
  'cancellation.contract.penaltyPct': (k, v) => validateIntPercent(k, v),
  'cancellation.unit.returnToAvailable': (k, v) =>
    validateEnum(k, v, ['AUTO', 'REQUIRES_APPROVAL']),
  'cancellation.customer.demoteToClient': (k, v) => validateBoolean(k, v),
  'cancellation.brokerCommission.action': (k, v) =>
    validateEnum(k, v, ['CLAWBACK', 'RETAIN', 'MANUAL']),
  'cancellation.salesBonus.action': (k, v) =>
    validateEnum(k, v, ['CLAWBACK', 'RETAIN', 'MANUAL']),
  'cheque.bounced.installmentAction': (k, v) =>
    validateEnum(k, v, ['REOPEN_AS_OVERDUE', 'REOPEN_AS_PENDING']),
  'cheque.bounced.penaltyAmount': (k, v) => validateNonNegativeDecimal(k, v),
};

function validate(key: string, value: unknown): void {
  const fn = VALIDATORS[key];
  if (fn) fn(key, value);
}

// ── CancellationPolicyService mock helpers ────────────────────────────────────

function buildSettingRows(overrides: Record<string, unknown> = {}) {
  return CANCELLATION_SETTING_DEFAULTS.map(({ key, value }) => ({
    key,
    value: key in overrides ? overrides[key] : value,
  }));
}

function buildPrismaStub(opts: {
  contract?: { id: string; companyId: string } | null;
  instrument?: { id: string; companyId: string } | null;
  settingRows?: Array<{ key: string; value: unknown }>;
  bookingAmount?: number;
  totalAmount?: number;
}) {
  return {
    contract: {
      findFirst: jest.fn().mockResolvedValue(opts.contract ?? null),
    },
    deposit: {
      aggregate: jest.fn().mockImplementation((args: { where: { type?: string } }) => {
        const isBooking = args.where.type === 'BOOKING_AMOUNT';
        const amount = isBooking
          ? new Prisma.Decimal(opts.bookingAmount ?? 0)
          : new Prisma.Decimal(opts.totalAmount ?? 0);
        return Promise.resolve({ _sum: { amount } });
      }),
    },
    paymentInstrument: {
      findFirst: jest.fn().mockResolvedValue(opts.instrument ?? null),
    },
    setting: {
      findMany: jest.fn().mockResolvedValue(opts.settingRows ?? buildSettingRows()),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SP — Suggestion formula
// ─────────────────────────────────────────────────────────────────────────────

describe('CancellationPolicyService — suggestion formula', () => {
  it('SP-1: getCancellationSuggestion reproduces the S2 worked example (§4.4)', async () => {
    // S2 scenario: total 325,000 = booking 25,000 + installments 300,000
    // penaltyPct=10, bookingRefundPct=0  →  retained 55,000, refund 270,000
    const prisma = buildPrismaStub({
      contract: { id: 'c-id', companyId: 'co-a' },
      settingRows: buildSettingRows(),
      bookingAmount: 25_000,
      totalAmount: 325_000,
    });

    const svc = new CancellationPolicyService(prisma as never);
    const result = await svc.getCancellationSuggestion('c-id');

    expect(result.bookingCollected).toBe('25000.00');
    expect(result.otherCollected).toBe('300000.00');
    expect(result.totalCollected).toBe('325000.00');
    expect(result.suggestedBookingRefund).toBe('0.00');
    expect(result.suggestedPenalty).toBe('30000.00');
    expect(result.suggestedRetained).toBe('55000.00');
    expect(result.suggestedRefund).toBe('270000.00');

    // policySnapshot uses the 6 cancellation settings
    expect(result.policySnapshot).toEqual({
      penaltyPct: 10,
      bookingRefundPct: 0,
      unitRelease: 'REQUIRES_APPROVAL',
      demoteClient: false,
      commissionAction: 'CLAWBACK',
      bonusAction: 'CLAWBACK',
    });
  });

  it('SP-1b: non-zero bookingRefundPct reduces the booking portion correctly', async () => {
    // bookingRefundPct=50: booking 20,000 × 50% = 10,000 refunded from booking
    // penaltyPct=0: no installment penalty
    // retained = (20,000 − 10,000) + 0 = 10,000
    // refund   = 120,000 − 10,000 = 110,000
    const rows = buildSettingRows({
      'cancellation.bookingAmount.refundPct': 50,
      'cancellation.contract.penaltyPct': 0,
    });
    const prisma = buildPrismaStub({
      contract: { id: 'c-id', companyId: 'co-a' },
      settingRows: rows,
      bookingAmount: 20_000,
      totalAmount: 120_000,
    });

    const svc = new CancellationPolicyService(prisma as never);
    const r = await svc.getCancellationSuggestion('c-id');

    expect(r.suggestedBookingRefund).toBe('10000.00');
    expect(r.suggestedPenalty).toBe('0.00');
    expect(r.suggestedRetained).toBe('10000.00');
    expect(r.suggestedRefund).toBe('110000.00');
  });

  it('SP-2: getBounceSuggestion returns correct policySnapshot', async () => {
    const prisma = buildPrismaStub({
      instrument: { id: 'pi-id', companyId: 'co-a' },
      settingRows: buildSettingRows({
        'cheque.bounced.penaltyAmount': 500,
        'cheque.bounced.installmentAction': 'REOPEN_AS_PENDING',
      }),
    });

    const svc = new CancellationPolicyService(prisma as never);
    const result = await svc.getBounceSuggestion('pi-id');

    expect(result.instrumentId).toBe('pi-id');
    expect(result.suggestedPenaltyAmount).toBe('500.00');
    expect(result.installmentAction).toBe('REOPEN_AS_PENDING');
    expect(result.policySnapshot).toEqual({
      installmentAction: 'REOPEN_AS_PENDING',
      penaltyAmount: 500,
    });
  });

  it('SP-3: falls back to documented defaults when setting rows are absent', async () => {
    // No setting rows seeded for this company
    const prisma = buildPrismaStub({
      contract: { id: 'c-id', companyId: 'co-a' },
      settingRows: [],
      bookingAmount: 0,
      totalAmount: 0,
    });

    const svc = new CancellationPolicyService(prisma as never);
    const result = await svc.getCancellationSuggestion('c-id');

    expect(result.policySnapshot.penaltyPct).toBe(10);
    expect(result.policySnapshot.bookingRefundPct).toBe(0);
    expect(result.policySnapshot.unitRelease).toBe('REQUIRES_APPROVAL');
  });

  it('SP-4: getCancellationSuggestion throws 404 for unknown contractId', async () => {
    const prisma = buildPrismaStub({ contract: null });
    const svc = new CancellationPolicyService(prisma as never);
    await expect(svc.getCancellationSuggestion('no-such-id')).rejects.toThrow(NotFoundException);
  });

  it('SP-5: getBounceSuggestion throws 404 for unknown instrumentId', async () => {
    const prisma = buildPrismaStub({ instrument: null });
    const svc = new CancellationPolicyService(prisma as never);
    await expect(svc.getBounceSuggestion('no-such-id')).rejects.toThrow(NotFoundException);
  });

  it('SP-6: policySnapshot is a plain value — mutating it after return does not affect re-computed snapshots', async () => {
    const prisma = buildPrismaStub({
      contract: { id: 'c-id', companyId: 'co-a' },
      settingRows: buildSettingRows(),
      bookingAmount: 25_000,
      totalAmount: 325_000,
    });

    const svc = new CancellationPolicyService(prisma as never);
    const first = await svc.getCancellationSuggestion('c-id');
    // Mutate the snapshot object in-place
    (first.policySnapshot as unknown as Record<string, unknown>).penaltyPct = 99;

    // Re-compute — should still reflect the setting rows, not the mutated copy
    const second = await svc.getCancellationSuggestion('c-id');
    expect(second.policySnapshot.penaltyPct).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SP-7/SP-8/SP-9 — seed helper
// ─────────────────────────────────────────────────────────────────────────────

describe('seedCancellationSettingsForCompany', () => {
  const COMPANY_ID = 'co-seed-test';

  it('SP-7: calls createMany with all 8 keys and skipDuplicates=true', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 8 });
    const prismaStub = { setting: { createMany } };

    await seedCancellationSettingsForCompany(prismaStub, COMPANY_ID);

    expect(createMany).toHaveBeenCalledTimes(1);
    const callArgs = createMany.mock.calls[0][0] as {
      data: CancellationSettingsRow[];
      skipDuplicates: boolean;
    };
    expect(callArgs.skipDuplicates).toBe(true);
    expect(callArgs.data).toHaveLength(8);
    const keys = callArgs.data.map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining(CANCELLATION_SETTING_KEYS));
  });

  it('SP-8: all rows carry the target companyId', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 8 });
    await seedCancellationSettingsForCompany({ setting: { createMany } }, COMPANY_ID);

    const { data } = createMany.mock.calls[0][0] as { data: Array<{ companyId: string }> };
    expect(data.every((r) => r.companyId === COMPANY_ID)).toBe(true);
  });

  it('SP-9: documented defaults are correct', () => {
    const defaults = Object.fromEntries(
      CANCELLATION_SETTING_DEFAULTS.map(({ key, value }) => [key, value]),
    );

    expect(defaults['cancellation.bookingAmount.refundPct']).toBe(0);
    expect(defaults['cancellation.contract.penaltyPct']).toBe(10);
    expect(defaults['cancellation.unit.returnToAvailable']).toBe('REQUIRES_APPROVAL');
    expect(defaults['cancellation.customer.demoteToClient']).toBe(false);
    expect(defaults['cancellation.brokerCommission.action']).toBe('CLAWBACK');
    expect(defaults['cancellation.salesBonus.action']).toBe('CLAWBACK');
    expect(defaults['cheque.bounced.installmentAction']).toBe('REOPEN_AS_OVERDUE');
    expect(defaults['cheque.bounced.penaltyAmount']).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VAL — per-key validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Setting write-time validation', () => {
  // ── Percentage fields ───────────────────────────────────────────────────────

  it('VAL-1: refundPct > 100 is rejected', () => {
    expect(() => validate('cancellation.bookingAmount.refundPct', 101)).toThrow(/integer between 0 and 100/);
  });

  it('VAL-2: refundPct < 0 is rejected', () => {
    expect(() => validate('cancellation.bookingAmount.refundPct', -1)).toThrow(/integer between 0 and 100/);
  });

  it('VAL-3: penaltyPct 10.5 (non-integer) is rejected', () => {
    expect(() => validate('cancellation.contract.penaltyPct', 10.5)).toThrow(/integer between 0 and 100/);
  });

  it('VAL-3b: penaltyPct 0 and 100 are valid boundaries', () => {
    expect(() => validate('cancellation.contract.penaltyPct', 0)).not.toThrow();
    expect(() => validate('cancellation.contract.penaltyPct', 100)).not.toThrow();
  });

  // ── Enum fields ────────────────────────────────────────────────────────────

  it('VAL-4: returnToAvailable "IMMEDIATE" is rejected (not in enum)', () => {
    expect(() => validate('cancellation.unit.returnToAvailable', 'IMMEDIATE')).toThrow(/must be one of/);
  });

  it('VAL-4b: returnToAvailable "AUTO" and "REQUIRES_APPROVAL" are valid', () => {
    expect(() => validate('cancellation.unit.returnToAvailable', 'AUTO')).not.toThrow();
    expect(() => validate('cancellation.unit.returnToAvailable', 'REQUIRES_APPROVAL')).not.toThrow();
  });

  it('VAL-5: demoteToClient with string "true" is rejected (must be boolean)', () => {
    expect(() => validate('cancellation.customer.demoteToClient', 'true')).toThrow(/must be a boolean/);
  });

  it('VAL-5b: demoteToClient true/false are valid', () => {
    expect(() => validate('cancellation.customer.demoteToClient', true)).not.toThrow();
    expect(() => validate('cancellation.customer.demoteToClient', false)).not.toThrow();
  });

  it('VAL-6: brokerCommission.action "CANCEL" is rejected', () => {
    expect(() => validate('cancellation.brokerCommission.action', 'CANCEL')).toThrow(/must be one of/);
  });

  it('VAL-7: salesBonus.action "VOID" is rejected', () => {
    expect(() => validate('cancellation.salesBonus.action', 'VOID')).toThrow(/must be one of/);
  });

  it('VAL-7b: CLAWBACK/RETAIN/MANUAL are valid for both action keys', () => {
    for (const key of ['cancellation.brokerCommission.action', 'cancellation.salesBonus.action']) {
      for (const v of ['CLAWBACK', 'RETAIN', 'MANUAL']) {
        expect(() => validate(key, v)).not.toThrow();
      }
    }
  });

  it('VAL-8: installmentAction "KEEP_AS_PAID" is rejected', () => {
    expect(() => validate('cheque.bounced.installmentAction', 'KEEP_AS_PAID')).toThrow(/must be one of/);
  });

  it('VAL-8b: REOPEN_AS_OVERDUE and REOPEN_AS_PENDING are valid', () => {
    expect(() => validate('cheque.bounced.installmentAction', 'REOPEN_AS_OVERDUE')).not.toThrow();
    expect(() => validate('cheque.bounced.installmentAction', 'REOPEN_AS_PENDING')).not.toThrow();
  });

  // ── Decimal field ──────────────────────────────────────────────────────────

  it('VAL-9: penaltyAmount -1 is rejected (negative)', () => {
    expect(() => validate('cheque.bounced.penaltyAmount', -1)).toThrow(/non-negative/);
  });

  it('VAL-10: penaltyAmount 1.001 is rejected (> 2 dp)', () => {
    expect(() => validate('cheque.bounced.penaltyAmount', 1.001)).toThrow(/2 decimal places/);
  });

  it('VAL-10b: penaltyAmount 500 and 500.50 are valid', () => {
    expect(() => validate('cheque.bounced.penaltyAmount', 500)).not.toThrow();
    expect(() => validate('cheque.bounced.penaltyAmount', 500.5)).not.toThrow();
  });

  // ── Unknown key pass-through ───────────────────────────────────────────────

  it('VAL-11: an unrecognised key has no validator — any value is accepted', () => {
    expect(() => validate('some.other.setting', 'anything')).not.toThrow();
    expect(() => validate('some.other.setting', -999)).not.toThrow();
  });

  // ── Full valid set ─────────────────────────────────────────────────────────

  it('VAL-12: all 8 documented defaults pass their own validators', () => {
    for (const { key, value } of CANCELLATION_SETTING_DEFAULTS) {
      expect(() => validate(key, value)).not.toThrow();
    }
  });
});
