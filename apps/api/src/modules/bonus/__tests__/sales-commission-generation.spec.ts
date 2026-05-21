import { Prisma, BonusEntryStatus, BonusEntrySource } from '@prisma/client';
import { BonusService } from '../bonus.module';
import type { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Automatic sales-commission generation (Batch B).
 *
 * Tests BonusService.materializeFromSignedContract directly against a hand-rolled
 * Prisma mock — mirrors the broker-commission test style. Asserts: PENDING
 * CONTRACT_AUTO entry with Decimal-exact amount; idempotency (existing entry +
 * P2002 race); and safe skips (not signed / no reservation / no sales / no rule /
 * ambiguous rules). Generated entries are never APPROVED/PAID, existing entries
 * are never mutated.
 */

const CONTRACT_ID = 'c1111111-1111-4111-8111-111111111111';
const SALES_ID = 'a2222222-2222-4222-8222-222222222222';
const RULE_ID = 'a3333333-3333-4333-8333-333333333333';
const ENTRY_ID = 'e4444444-4444-4444-8444-444444444444';

interface ContractFixture {
  id: string;
  signedAt: Date | null;
  totalAmount: Prisma.Decimal;
  reservationId: string | null;
  reservation: { salesId: string | null } | null;
  bonusEntry: { id: string } | null;
}

function makeMock(opts: {
  contract: ContractFixture | null;
  rules?: Array<{ id: string; percentage: Prisma.Decimal }>;
  createImpl?: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  existingByContract?: { id: string } | null;
}) {
  const bonusEntryCreate = jest.fn(
    opts.createImpl ??
      (async () => ({ id: ENTRY_ID })),
  );
  const bonusEntryFindUnique = jest
    .fn()
    .mockResolvedValue(opts.existingByContract ?? null);
  const bonusEntryUpdate = jest.fn();
  const prisma = {
    contract: { findUnique: jest.fn().mockResolvedValue(opts.contract) },
    bonusRule: { findMany: jest.fn().mockResolvedValue(opts.rules ?? []) },
    bonusEntry: {
      create: bonusEntryCreate,
      findUnique: bonusEntryFindUnique,
      update: bonusEntryUpdate,
    },
  } as unknown as PrismaService;
  return { service: new BonusService(prisma), bonusEntryCreate, bonusEntryFindUnique, bonusEntryUpdate };
}

function signedContract(over: Partial<ContractFixture> = {}): ContractFixture {
  return {
    id: CONTRACT_ID,
    signedAt: new Date('2030-04-15T10:00:00.000Z'),
    totalAmount: new Prisma.Decimal(300000),
    reservationId: 'r5555555-5555-4555-8555-555555555555',
    reservation: { salesId: SALES_ID },
    bonusEntry: null,
    ...over,
  };
}

const oneRule = [{ id: RULE_ID, percentage: new Prisma.Decimal(2) }];

describe('BonusService · materializeFromSignedContract', () => {
  it('creates one PENDING CONTRACT_AUTO entry with the correct fields', async () => {
    const { service, bonusEntryCreate } = makeMock({ contract: signedContract(), rules: oneRule });
    const res = await service.materializeFromSignedContract(CONTRACT_ID);

    expect(res).toEqual({ status: 'created', entryId: ENTRY_ID });
    expect(bonusEntryCreate).toHaveBeenCalledTimes(1);
    const data = bonusEntryCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data.salesId).toBe(SALES_ID);
    expect(data.ruleId).toBe(RULE_ID);
    expect(data.contractId).toBe(CONTRACT_ID);
    expect(data.status).toBe(BonusEntryStatus.PENDING);
    expect(data.source).toBe(BonusEntrySource.CONTRACT_AUTO);
    expect(data.period).toBe('2030-04');
    expect(data.paidAt).toBeNull();
    // Decimal-exact: 300000 × 2% = 6000.
    expect((data.amount as Prisma.Decimal).toString()).toBe('6000');
    expect((data.basisAmount as Prisma.Decimal).toString()).toBe('300000');
    expect((data.commissionPct as Prisma.Decimal).toString()).toBe('2');
  });

  it('is idempotent — existing contract entry returns already_exists, no create/update', async () => {
    const { service, bonusEntryCreate, bonusEntryUpdate } = makeMock({
      contract: signedContract({ bonusEntry: { id: ENTRY_ID } }),
      rules: oneRule,
    });
    const res = await service.materializeFromSignedContract(CONTRACT_ID);
    expect(res).toEqual({ status: 'already_exists', entryId: ENTRY_ID });
    expect(bonusEntryCreate).not.toHaveBeenCalled();
    expect(bonusEntryUpdate).not.toHaveBeenCalled();
  });

  it('skips when the contract is not signed', async () => {
    const { service, bonusEntryCreate } = makeMock({
      contract: signedContract({ signedAt: null }),
      rules: oneRule,
    });
    expect(await service.materializeFromSignedContract(CONTRACT_ID)).toEqual({
      status: 'skipped',
      reason: 'not_signed',
    });
    expect(bonusEntryCreate).not.toHaveBeenCalled();
  });

  it('skips when there is no reservation', async () => {
    const { service } = makeMock({
      contract: signedContract({ reservationId: null, reservation: null }),
      rules: oneRule,
    });
    expect(await service.materializeFromSignedContract(CONTRACT_ID)).toEqual({
      status: 'skipped',
      reason: 'no_reservation',
    });
  });

  it('skips when the reservation has no sales rep', async () => {
    const { service } = makeMock({
      contract: signedContract({ reservation: { salesId: null } }),
      rules: oneRule,
    });
    expect(await service.materializeFromSignedContract(CONTRACT_ID)).toEqual({
      status: 'skipped',
      reason: 'no_sales',
    });
  });

  it('skips when no active auto-apply rule exists', async () => {
    const { service } = makeMock({ contract: signedContract(), rules: [] });
    expect(await service.materializeFromSignedContract(CONTRACT_ID)).toEqual({
      status: 'skipped',
      reason: 'no_rule',
    });
  });

  it('skips when more than one active auto-apply rule exists', async () => {
    const { service } = makeMock({
      contract: signedContract(),
      rules: [
        { id: RULE_ID, percentage: new Prisma.Decimal(2) },
        { id: 'a9999999-9999-4999-8999-999999999999', percentage: new Prisma.Decimal(3) },
      ],
    });
    expect(await service.materializeFromSignedContract(CONTRACT_ID)).toEqual({
      status: 'skipped',
      reason: 'ambiguous_rules',
    });
  });

  it('handles the P2002 race — re-queries and returns already_exists', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const { service, bonusEntryFindUnique } = makeMock({
      contract: signedContract(),
      rules: oneRule,
      createImpl: async () => {
        throw p2002;
      },
      existingByContract: { id: ENTRY_ID },
    });
    const res = await service.materializeFromSignedContract(CONTRACT_ID);
    expect(res).toEqual({ status: 'already_exists', entryId: ENTRY_ID });
    expect(bonusEntryFindUnique).toHaveBeenCalledWith({
      where: { contractId: CONTRACT_ID },
      select: { id: true },
    });
  });

  it('skips when the contract is missing entirely', async () => {
    const { service } = makeMock({ contract: null });
    expect(await service.materializeFromSignedContract(CONTRACT_ID)).toEqual({
      status: 'skipped',
      reason: 'no_reservation',
    });
  });
});
