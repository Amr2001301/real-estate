import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  isSalesIdInScope,
  assertSalesRecordInScope,
  resolveSalesScope,
} from '../sales-scope';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../decorators/current-user.decorator';

/**
 * Per-record team ownership (Batch 10) + list scope resolution (Batch 9).
 *
 * Team fixture: MANAGER_ID owns exactly [SALES_ID]. OTHER_SALES_ID is a SALES
 * rep on a different team. The mock answers user.findMany for the team lookup.
 */
const MANAGER_ID = 'mgr-1';
const SALES_ID = 'sales-1';
const OTHER_SALES_ID = 'sales-2';

function prismaMock(): PrismaService {
  return {
    user: {
      findMany: jest.fn().mockImplementation(async ({ where }) =>
        where?.role === UserRole.SALES && where.managerId === MANAGER_ID
          ? [{ id: SALES_ID }]
          : [],
      ),
    },
  } as unknown as PrismaService;
}

const admin: AuthUser = { sub: 'a', role: UserRole.ADMIN, email: null, phone: null, companyId: null };
const sales: AuthUser = { sub: SALES_ID, role: UserRole.SALES, email: null, phone: null, companyId: null };
const manager: AuthUser = { sub: MANAGER_ID, role: UserRole.SALES_MANAGER, email: null, phone: null, companyId: null };
const customer: AuthUser = { sub: 'c', role: UserRole.CUSTOMER, email: null, phone: null, companyId: null };

describe('sales-scope · isSalesIdInScope', () => {
  it('ADMIN is always in scope (even for null owner)', async () => {
    expect(await isSalesIdInScope(prismaMock(), admin, OTHER_SALES_ID)).toBe(true);
    expect(await isSalesIdInScope(prismaMock(), admin, null)).toBe(true);
  });

  it('SALES is in scope only for their own records', async () => {
    expect(await isSalesIdInScope(prismaMock(), sales, SALES_ID)).toBe(true);
    expect(await isSalesIdInScope(prismaMock(), sales, OTHER_SALES_ID)).toBe(false);
    expect(await isSalesIdInScope(prismaMock(), sales, null)).toBe(false);
  });

  it('SALES_MANAGER is in scope for self and team members', async () => {
    expect(await isSalesIdInScope(prismaMock(), manager, MANAGER_ID)).toBe(true); // self
    expect(await isSalesIdInScope(prismaMock(), manager, SALES_ID)).toBe(true); // team
    expect(await isSalesIdInScope(prismaMock(), manager, OTHER_SALES_ID)).toBe(false); // other team
    expect(await isSalesIdInScope(prismaMock(), manager, null)).toBe(false);
  });

  it('other roles are never in scope', async () => {
    expect(await isSalesIdInScope(prismaMock(), customer, SALES_ID)).toBe(false);
  });
});

describe('sales-scope · assertSalesRecordInScope', () => {
  it('no-ops for ADMIN', async () => {
    await expect(assertSalesRecordInScope(prismaMock(), admin, OTHER_SALES_ID)).resolves.toBeUndefined();
  });

  it('throws NotFound (default) for a manager on an out-of-team record', async () => {
    await expect(assertSalesRecordInScope(prismaMock(), manager, OTHER_SALES_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('passes for a manager on a team record', async () => {
    await expect(assertSalesRecordInScope(prismaMock(), manager, SALES_ID)).resolves.toBeUndefined();
  });

  it('throws Forbidden when mode=forbidden', async () => {
    await expect(
      assertSalesRecordInScope(prismaMock(), manager, OTHER_SALES_ID, { mode: 'forbidden' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('managersOnly skips the SALES self-check (leaves existing SALES behavior unchanged)', async () => {
    // With managersOnly, a SALES caller is not enforced here at all.
    await expect(
      assertSalesRecordInScope(prismaMock(), sales, OTHER_SALES_ID, { managersOnly: true }),
    ).resolves.toBeUndefined();
    // …but a manager is still enforced.
    await expect(
      assertSalesRecordInScope(prismaMock(), manager, OTHER_SALES_ID, { managersOnly: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('sales-scope · resolveSalesScope (regression)', () => {
  it('manager out-of-team salesId yields an empty set', async () => {
    expect(await resolveSalesScope(prismaMock(), manager, OTHER_SALES_ID)).toEqual({ salesIds: [] });
  });
  it('manager in-team salesId narrows to that rep', async () => {
    expect(await resolveSalesScope(prismaMock(), manager, SALES_ID)).toEqual({ salesId: SALES_ID });
  });
  it('manager own salesId narrows to self', async () => {
    expect(await resolveSalesScope(prismaMock(), manager, MANAGER_ID)).toEqual({ salesId: MANAGER_ID });
  });
  it('manager with no salesId returns self + team', async () => {
    expect(await resolveSalesScope(prismaMock(), manager, undefined)).toEqual({
      salesIds: [MANAGER_ID, SALES_ID],
    });
  });
});
