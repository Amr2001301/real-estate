/**
 * MT-034 — CompanyLifecycleGuard enforcement scenario tests
 *
 * Tests the specific scenarios called out in the D2 acceptance spec:
 *
 *  Section 14 — Existing-session suspension
 *    Token issued before suspension → same request denied after Company suspended
 *    (The guard re-queries DB on every request; JWT payload carries no lifecycle state)
 *
 *  Section 15 — Tenant isolation
 *    Company A suspended → User A denied; Company B active → User B unaffected
 *
 *  Section 16 — Legacy null-companyId CLIENT/CUSTOMER
 *    With fallback: DEFAULT company ACTIVE → allowed
 *    With fallback: DEFAULT company SUSPENDED → denied
 *    Staff with null companyId → guard passes (TenantContextInterceptor handles)
 *    DISABLE_DEFAULT_COMPANY_FALLBACK=true → guard passes (no effective company)
 *
 *  Auth matrix (guard level):
 *    Various roles with ACTIVE company → allowed
 *    Various roles with SUSPENDED company → denied
 *    SUPER_ADMIN → always allowed regardless of lifecycle
 *    No user → always allowed (public routes)
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CompanyLifecycleGuard } from '../lifecycle.guard';

const DEFAULT_COMPANY = 'default-co-id';

function makeGuard(lifecycleByCompanyId: Record<string, string | null>) {
  const prisma = {
    company: {
      findUnique: jest.fn().mockImplementation(
        ({ where }: { where: { id: string } }) => {
          const status = lifecycleByCompanyId[where.id];
          if (status === undefined || status === null) return Promise.resolve(null);
          return Promise.resolve({ lifecycleStatus: status });
        },
      ),
    },
  };
  return { guard: new CompanyLifecycleGuard(prisma as never), prisma };
}

function makeCtx(user: Record<string, unknown> | null) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

// ── Section 14: Existing-session suspension ───────────────────────────────────

describe('Section 14 — existing-session suspension', () => {
  test('token issued before suspension: same request denied after company suspended', async () => {
    // Simulate: guard queries DB on every request, not the JWT.
    // First call: company ACTIVE → token issued (simulated — not tested here).
    // Second call: company becomes SUSPENDED → guard denies the SAME user.
    const prisma = {
      company: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ lifecycleStatus: 'ACTIVE' })     // first request (before suspension)
          .mockResolvedValueOnce({ lifecycleStatus: 'SUSPENDED' }),  // second request (after suspension)
      },
    };
    const guard = new CompanyLifecycleGuard(prisma as never);
    const user = { sub: 'user-1', role: 'ADMIN', companyId: 'company-a' };

    // First request with the SAME token — company still active → allowed
    const firstResult = await guard.canActivate(makeCtx(user));
    expect(firstResult).toBe(true);

    // Second request with the SAME token — company now suspended → denied
    await expect(guard.canActivate(makeCtx(user))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COMPANY_NOT_ACTIVE' }),
    });

    // Guard queried DB twice: once before, once after suspension
    expect(prisma.company.findUnique).toHaveBeenCalledTimes(2);
  });

  test('lifecycle state change is reflected on very next request (no caching in guard)', async () => {
    const prisma = {
      company: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ lifecycleStatus: 'ACTIVE' })
          .mockResolvedValueOnce({ lifecycleStatus: 'ARCHIVED' }),
      },
    };
    const guard = new CompanyLifecycleGuard(prisma as never);
    const user = { sub: 'user-2', role: 'SALES', companyId: 'company-a' };

    await guard.canActivate(makeCtx(user));
    await expect(guard.canActivate(makeCtx(user))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── Section 15: Tenant isolation ─────────────────────────────────────────────

describe('Section 15 — tenant isolation', () => {
  test('Company A suspended does NOT affect Company B (active)', async () => {
    const { guard } = makeGuard({
      'company-a': 'SUSPENDED',
      'company-b': 'ACTIVE',
    });

    await expect(
      guard.canActivate(makeCtx({ sub: 'user-a', role: 'ADMIN', companyId: 'company-a' })),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const result = await guard.canActivate(
      makeCtx({ sub: 'user-b', role: 'ADMIN', companyId: 'company-b' }),
    );
    expect(result).toBe(true);
  });

  test('Company B active does NOT grant access if Company A is ARCHIVED', async () => {
    const { guard } = makeGuard({
      'company-a': 'ARCHIVED',
      'company-b': 'ACTIVE',
    });
    // user-a belongs to company-a (ARCHIVED) — still denied even though company-b is fine
    await expect(
      guard.canActivate(makeCtx({ sub: 'user-a', role: 'SALES', companyId: 'company-a' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('guard uses req.user.companyId, not a shared/global state', async () => {
    const { guard, prisma } = makeGuard({
      'company-a': 'SUSPENDED',
      'company-b': 'ACTIVE',
    });
    // Simulate interleaved requests
    const ctxA = makeCtx({ sub: 'ua', role: 'ADMIN', companyId: 'company-a' });
    const ctxB = makeCtx({ sub: 'ub', role: 'ADMIN', companyId: 'company-b' });

    await expect(guard.canActivate(ctxA)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctxB)).resolves.toBe(true);
    await expect(guard.canActivate(ctxA)).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.company.findUnique).toHaveBeenNthCalledWith(1,
      { where: { id: 'company-a' }, select: { lifecycleStatus: true } });
    expect(prisma.company.findUnique).toHaveBeenNthCalledWith(2,
      { where: { id: 'company-b' }, select: { lifecycleStatus: true } });
  });
});

// ── Section 16: Legacy null-companyId CLIENT/CUSTOMER ────────────────────────

describe('Section 16 — legacy null-companyId CLIENT/CUSTOMER', () => {
  beforeEach(() => {
    process.env.DEFAULT_COMPANY_ID = DEFAULT_COMPANY;
    process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'false';
  });

  afterEach(() => {
    delete process.env.DISABLE_DEFAULT_COMPANY_FALLBACK;
  });

  test('CLIENT null companyId, DEFAULT company ACTIVE → allowed', async () => {
    const { guard } = makeGuard({ [DEFAULT_COMPANY]: 'ACTIVE' });
    const result = await guard.canActivate(
      makeCtx({ sub: 'c1', role: 'CLIENT', companyId: null }),
    );
    expect(result).toBe(true);
  });

  test('CLIENT null companyId, DEFAULT company SUSPENDED → denied', async () => {
    const { guard } = makeGuard({ [DEFAULT_COMPANY]: 'SUSPENDED' });
    await expect(
      guard.canActivate(makeCtx({ sub: 'c1', role: 'CLIENT', companyId: null })),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COMPANY_NOT_ACTIVE' }),
    });
  });

  test('CUSTOMER null companyId, DEFAULT company ARCHIVED → denied', async () => {
    const { guard } = makeGuard({ [DEFAULT_COMPANY]: 'ARCHIVED' });
    await expect(
      guard.canActivate(makeCtx({ sub: 'c1', role: 'CUSTOMER', companyId: null })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('Staff (ADMIN) with null companyId → guard passes regardless of DEFAULT company status', async () => {
    const { guard, prisma } = makeGuard({ [DEFAULT_COMPANY]: 'SUSPENDED' });
    const result = await guard.canActivate(
      makeCtx({ sub: 'u1', role: 'ADMIN', companyId: null }),
    );
    expect(result).toBe(true);
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
  });

  test('DISABLE_DEFAULT_COMPANY_FALLBACK=true: null CLIENT → guard passes (no effective company)', async () => {
    process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'true';
    const { guard, prisma } = makeGuard({ [DEFAULT_COMPANY]: 'SUSPENDED' });
    const result = await guard.canActivate(
      makeCtx({ sub: 'c1', role: 'CLIENT', companyId: null }),
    );
    expect(result).toBe(true);
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
  });
});

// ── Auth role matrix ──────────────────────────────────────────────────────────

describe('Auth role matrix — ACTIVE company', () => {
  const roles = ['ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR', 'BROKER', 'CLIENT', 'CUSTOMER'];

  test.each(roles)('%s with ACTIVE company → allowed', async (role) => {
    const { guard } = makeGuard({ 'comp-x': 'ACTIVE' });
    const result = await guard.canActivate(
      makeCtx({ sub: 'u1', role, companyId: 'comp-x' }),
    );
    expect(result).toBe(true);
  });
});

describe('Auth role matrix — SUSPENDED company', () => {
  const roles = ['ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR', 'BROKER', 'CLIENT', 'CUSTOMER'];

  test.each(roles)('%s with SUSPENDED company → denied', async (role) => {
    const { guard } = makeGuard({ 'comp-x': 'SUSPENDED' });
    await expect(
      guard.canActivate(makeCtx({ sub: 'u1', role, companyId: 'comp-x' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Auth role matrix — SUPER_ADMIN always passes', () => {
  test('SUPER_ADMIN with null companyId → allowed regardless of any company', async () => {
    const { guard, prisma } = makeGuard({ 'comp-x': 'SUSPENDED' });
    const result = await guard.canActivate(
      makeCtx({ sub: 'sa1', role: 'SUPER_ADMIN', companyId: null }),
    );
    expect(result).toBe(true);
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
  });
});

describe('Auth role matrix — no user (public routes)', () => {
  test('no user → guard returns true (public route, not an auth guard)', async () => {
    const { guard } = makeGuard({ 'comp-x': 'SUSPENDED' });
    const result = await guard.canActivate(makeCtx(null));
    expect(result).toBe(true);
  });
});
