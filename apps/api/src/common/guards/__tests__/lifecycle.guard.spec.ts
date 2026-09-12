/**
 * MT-034 — CompanyLifecycleGuard unit tests (updated for global enforcement)
 *
 * Verifies (using actual D1 enum values: ACTIVE, SUSPENDED, ARCHIVED):
 *  1.  ACTIVE → allowed
 *  2.  SUSPENDED → denied (code: COMPANY_NOT_ACTIVE)
 *  3.  ARCHIVED → denied (code: COMPANY_NOT_ACTIVE)
 *  4.  SUPER_ADMIN (companyId=null) → allowed regardless of lifecycle
 *  5.  No user (public/unauthenticated) → allowed (guard is not an auth guard)
 *  6.  Company not found in DB → denied
 *  7.  Company A blocked does NOT affect Company B
 *  8.  CLIENT with null companyId + DEFAULT fallback active → checks DEFAULT company
 *  9.  CLIENT with null companyId + DEFAULT company SUSPENDED → denied
 * 10.  CUSTOMER with null companyId + DEFAULT company ACTIVE → allowed
 * 11.  Staff (ADMIN) with null companyId → guard passes (TenantContextInterceptor handles)
 * 12.  DISABLE_DEFAULT_COMPANY_FALLBACK=true + null CLIENT → guard passes (no effective company)
 * 13.  resolveEffectiveCompanyId: companyId present → returns it
 * 14.  resolveEffectiveCompanyId: CLIENT null → DEFAULT_COMPANY_ID when fallback enabled
 * 15.  resolveEffectiveCompanyId: staff null → null (no fallback)
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CompanyLifecycleGuard, resolveEffectiveCompanyId } from '../lifecycle.guard';

const DEFAULT_COMPANY = 'default-company-id';

function makePrisma(lifecycleStatus: string | null) {
  return {
    company: {
      findUnique: jest.fn().mockResolvedValue(
        lifecycleStatus !== null ? { lifecycleStatus } : null,
      ),
    },
  };
}

function makeCtx(user: Record<string, unknown> | null) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

// ── 1. ACTIVE → allowed ───────────────────────────────────────────────────────

test('ACTIVE lifecycle → canActivate returns true', async () => {
  const guard = new CompanyLifecycleGuard(makePrisma('ACTIVE') as never);
  const result = await guard.canActivate(makeCtx({ sub: 'u1', role: 'ADMIN', companyId: 'c-1' }));
  expect(result).toBe(true);
});

// ── 2. SUSPENDED → denied ─────────────────────────────────────────────────────

test('SUSPENDED lifecycle → throws ForbiddenException with code COMPANY_NOT_ACTIVE', async () => {
  const guard = new CompanyLifecycleGuard(makePrisma('SUSPENDED') as never);
  await expect(
    guard.canActivate(makeCtx({ sub: 'u1', role: 'SALES', companyId: 'c-1' })),
  ).rejects.toMatchObject({
    response: expect.objectContaining({ code: 'COMPANY_NOT_ACTIVE' }),
  });
});

// ── 3. ARCHIVED → denied ──────────────────────────────────────────────────────

test('ARCHIVED lifecycle → throws ForbiddenException', async () => {
  const guard = new CompanyLifecycleGuard(makePrisma('ARCHIVED') as never);
  await expect(
    guard.canActivate(makeCtx({ sub: 'u1', role: 'ADMIN', companyId: 'c-1' })),
  ).rejects.toBeInstanceOf(ForbiddenException);
});

// ── 4. SUPER_ADMIN bypasses lifecycle ─────────────────────────────────────────

test('SUPER_ADMIN is always allowed (no company lifecycle check)', async () => {
  const prisma = makePrisma('SUSPENDED');
  const guard = new CompanyLifecycleGuard(prisma as never);
  const result = await guard.canActivate(
    makeCtx({ sub: 'sa1', role: 'SUPER_ADMIN', companyId: null }),
  );
  expect(result).toBe(true);
  expect(prisma.company.findUnique).not.toHaveBeenCalled();
});

// ── 5. No user → guard passes (public / unauthenticated) ─────────────────────

test('no user on request → canActivate returns true (not an auth guard)', async () => {
  const guard = new CompanyLifecycleGuard(makePrisma('ACTIVE') as never);
  const result = await guard.canActivate(makeCtx(null));
  expect(result).toBe(true);
});

// ── 6. Company not found → denied ─────────────────────────────────────────────

test('company not found in DB → throws ForbiddenException with COMPANY_NOT_ACTIVE', async () => {
  const guard = new CompanyLifecycleGuard(makePrisma(null) as never);
  await expect(
    guard.canActivate(makeCtx({ sub: 'u1', role: 'ADMIN', companyId: 'missing-id' })),
  ).rejects.toMatchObject({
    response: expect.objectContaining({ code: 'COMPANY_NOT_ACTIVE' }),
  });
});

// ── 7. Company A blocked does not affect B ────────────────────────────────────

test('Company A blocked does NOT affect Company B', async () => {
  const prisma = {
    company: {
      findUnique: jest.fn()
        .mockResolvedValueOnce({ lifecycleStatus: 'SUSPENDED' }) // A
        .mockResolvedValueOnce({ lifecycleStatus: 'ACTIVE' }),    // B
    },
  };
  const guard = new CompanyLifecycleGuard(prisma as never);

  await expect(
    guard.canActivate(makeCtx({ sub: 'u1', role: 'ADMIN', companyId: 'comp-a' })),
  ).rejects.toBeInstanceOf(ForbiddenException);

  const resultB = await guard.canActivate(
    makeCtx({ sub: 'u2', role: 'ADMIN', companyId: 'comp-b' }),
  );
  expect(resultB).toBe(true);
});

// ── 8. CLIENT with null companyId + DEFAULT fallback: checks DEFAULT company ──

test('CLIENT with null companyId + fallback enabled → checks DEFAULT_COMPANY_ID company', async () => {
  process.env.DEFAULT_COMPANY_ID = DEFAULT_COMPANY;
  process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'false';
  const prisma = makePrisma('ACTIVE');
  const guard = new CompanyLifecycleGuard(prisma as never);

  await guard.canActivate(makeCtx({ sub: 'u1', role: 'CLIENT', companyId: null }));

  expect(prisma.company.findUnique).toHaveBeenCalledWith({
    where: { id: DEFAULT_COMPANY },
    select: { lifecycleStatus: true },
  });
});

// ── 9. CLIENT null companyId + DEFAULT company SUSPENDED → denied ─────────────

test('CLIENT with null companyId, DEFAULT company SUSPENDED → denied', async () => {
  process.env.DEFAULT_COMPANY_ID = DEFAULT_COMPANY;
  process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'false';
  const guard = new CompanyLifecycleGuard(makePrisma('SUSPENDED') as never);

  await expect(
    guard.canActivate(makeCtx({ sub: 'u1', role: 'CLIENT', companyId: null })),
  ).rejects.toMatchObject({
    response: expect.objectContaining({ code: 'COMPANY_NOT_ACTIVE' }),
  });
});

// ── 10. CUSTOMER null companyId + DEFAULT ACTIVE → allowed ────────────────────

test('CUSTOMER with null companyId, DEFAULT company ACTIVE → allowed', async () => {
  process.env.DEFAULT_COMPANY_ID = DEFAULT_COMPANY;
  process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'false';
  const guard = new CompanyLifecycleGuard(makePrisma('ACTIVE') as never);

  const result = await guard.canActivate(
    makeCtx({ sub: 'u1', role: 'CUSTOMER', companyId: null }),
  );
  expect(result).toBe(true);
});

// ── 11. Staff (ADMIN) with null companyId → guard passes ─────────────────────

test('ADMIN with null companyId → guard passes (TenantContextInterceptor denies)', async () => {
  process.env.DEFAULT_COMPANY_ID = DEFAULT_COMPANY;
  process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'false';
  const prisma = makePrisma('SUSPENDED'); // deliberately bad — should NOT be queried
  const guard = new CompanyLifecycleGuard(prisma as never);

  const result = await guard.canActivate(
    makeCtx({ sub: 'u1', role: 'ADMIN', companyId: null }),
  );
  expect(result).toBe(true);
  expect(prisma.company.findUnique).not.toHaveBeenCalled();
});

// ── 12. DISABLE_DEFAULT_COMPANY_FALLBACK=true + null CLIENT → guard passes ────

test('DISABLE_DEFAULT_COMPANY_FALLBACK=true + null CLIENT → guard passes (no effective company)', async () => {
  process.env.DEFAULT_COMPANY_ID = DEFAULT_COMPANY;
  process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'true';
  const prisma = makePrisma('SUSPENDED');
  const guard = new CompanyLifecycleGuard(prisma as never);

  const result = await guard.canActivate(
    makeCtx({ sub: 'u1', role: 'CLIENT', companyId: null }),
  );
  expect(result).toBe(true);
  expect(prisma.company.findUnique).not.toHaveBeenCalled();

  // Restore
  process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'false';
});

// ── 13-15. resolveEffectiveCompanyId unit tests ───────────────────────────────

describe('resolveEffectiveCompanyId', () => {
  beforeEach(() => {
    process.env.DEFAULT_COMPANY_ID = DEFAULT_COMPANY;
    process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'false';
  });

  test('companyId present → returns it', () => {
    expect(resolveEffectiveCompanyId('explicit-id', 'ADMIN')).toBe('explicit-id');
  });

  test('CLIENT with null companyId → DEFAULT_COMPANY_ID when fallback enabled', () => {
    expect(resolveEffectiveCompanyId(null, 'CLIENT')).toBe(DEFAULT_COMPANY);
  });

  test('CUSTOMER with null companyId → DEFAULT_COMPANY_ID when fallback enabled', () => {
    expect(resolveEffectiveCompanyId(null, 'CUSTOMER')).toBe(DEFAULT_COMPANY);
  });

  test('staff (ADMIN) with null companyId → null (no fallback for staff)', () => {
    expect(resolveEffectiveCompanyId(null, 'ADMIN')).toBeNull();
  });

  test('staff (SALES) with null companyId → null', () => {
    expect(resolveEffectiveCompanyId(null, 'SALES')).toBeNull();
  });

  test('DISABLE_DEFAULT_COMPANY_FALLBACK=true → null even for CLIENT', () => {
    process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'true';
    expect(resolveEffectiveCompanyId(null, 'CLIENT')).toBeNull();
  });
});
