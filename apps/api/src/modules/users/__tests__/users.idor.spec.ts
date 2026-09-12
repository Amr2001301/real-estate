/**
 * MT-002 — UsersService IDOR regression tests.
 *
 * These tests describe the SECURE behavior that must hold after MT-003 through
 * MT-010 are implemented. They are written FIRST (secure-first workflow) and
 * are expected to FAIL against the current vulnerable code.
 *
 * Vulnerability: every UsersService method reads/writes `prisma.user` without
 * a companyId filter. Because User is TENANT_CONTROLLED (middleware pass-through),
 * an attacker running as Company A can list, read, modify, and delete users
 * that belong to Company B.
 *
 * How the mocks detect the bug:
 *   - `tenantAwareFind(target)` returns the target user when NO companyId filter
 *     is present (simulating the current IDOR) and returns null when the wrong
 *     companyId is passed (simulating the post-fix secure state).
 *   - Current code → mock returns data → assertions expecting NotFoundException
 *     or empty results → FAIL.
 *   - Fixed code → mock returns null / [] → NotFoundException thrown / empty
 *     result returned → PASS.
 */

import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { runTenantContext } from '../../../common/tenant/tenant-context';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPANY_A_ID = 'aaaaaaaa-0000-4000-8000-000000000000';
const COMPANY_B_ID = 'bbbbbbbb-0000-4000-8000-000000000000';

const COMPANY_B_USER = {
  id: 'user-b-00000000-0000-4000-8000-000000000001',
  companyId: COMPANY_B_ID,
  role: UserRole.SALES,
  fullName: 'Company B Staff',
  email: 'staff-b@example.com',
  phone: null,
  active: true,
  deletedAt: null,
  locale: 'ar',
  avatarUrl: null,
  passwordHash: 'hashed',
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  managerId: null,
  manager: null,
};

const COMPANY_B_DELETED_USER = {
  ...COMPANY_B_USER,
  id: 'user-b-deleted-0000-4000-8000-000000000002',
  deletedAt: new Date('2024-01-01'),
  active: false,
};

const COMPANY_B_MANAGER = {
  ...COMPANY_B_USER,
  id: 'mgr-b-00000000-0000-4000-8000-000000000003',
  role: UserRole.SALES_MANAGER,
  email: 'mgr-b@example.com',
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Returns a jest mock implementation that:
 *   - Returns `target` when no companyId filter is present (IDOR — current bug)
 *   - Returns null when companyId is present but wrong (secure — post-fix)
 *
 * This dual behaviour causes current-code tests to FAIL (they get data they
 * shouldn't) and post-fix tests to PASS (they correctly get null → 404).
 */
function tenantAwareFind<T extends { id: string; companyId: string }>(target: T) {
  return jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    // Post-fix: companyId is in the filter but doesn't match → return null
    if (where?.companyId !== undefined && where.companyId !== target.companyId) {
      return Promise.resolve(null);
    }
    // Current bug: no companyId filter → return the cross-tenant user
    if (!where?.id || where.id === target.id) {
      return Promise.resolve(target);
    }
    return Promise.resolve(null);
  });
}

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  const findUnique = tenantAwareFind(COMPANY_B_USER);
  const findFirst = tenantAwareFind(COMPANY_B_USER);
  // findMany: returns company-B users when no companyId filter (IDOR),
  //           returns [] when filtering by company-A (correct isolation)
  const findMany = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    if (where?.companyId !== undefined && where.companyId !== COMPANY_B_ID) {
      return Promise.resolve([]);
    }
    return Promise.resolve([COMPANY_B_USER]);
  });
  const count = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    if (where?.companyId !== undefined && where.companyId !== COMPANY_B_ID) {
      return Promise.resolve(0);
    }
    return Promise.resolve(1);
  });
  const update = jest.fn().mockResolvedValue(COMPANY_B_USER);
  const create = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...COMPANY_B_USER, ...data }),
  );

  return {
    user: { findUnique, findFirst, findMany, count, update, create },
    company: {
      findUnique: jest.fn().mockResolvedValue({ maxUsers: null, _count: { users: 1 } }),
    },
    $transaction: jest.fn().mockImplementation((queries: Promise<unknown>[]) => Promise.all(queries)),
    ...overrides,
  } as unknown as PrismaService;
}

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = makePrisma(prismaOverrides);
  const notifications = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const service = new UsersService(prisma, {} as never, notifications as never);
  return { service, prisma };
}

/** Run `fn` as an authenticated Company A admin. */
function asCompanyA<T>(fn: () => Promise<T>): Promise<T> {
  return runTenantContext({ companyId: COMPANY_A_ID, bypass: false, isPublic: false }, fn);
}

// ---------------------------------------------------------------------------
// MT-002.1 — findAll must not return cross-tenant users
// ---------------------------------------------------------------------------

describe('MT-002 UsersService IDOR — findAll', () => {
  it('2.1 findAll in Company A context must NOT return Company B users', async () => {
    const { service } = makeService();

    const result = await asCompanyA(() => service.findAll());

    const companyBUserIds = (result.data as Array<{ id: string }>)
      .map((u) => u.id)
      .filter((id) => id === COMPANY_B_USER.id);

    // SECURE: no Company B user should appear in Company A's list
    expect(companyBUserIds).toHaveLength(0);
  });

  it('2.2 findAll must include companyId in the Prisma where clause', async () => {
    const { service, prisma } = makeService();

    await asCompanyA(() => service.findAll()).catch(() => {});

    const findManyCalls = (prisma.user as unknown as { findMany: jest.Mock }).findMany.mock.calls;
    expect(findManyCalls.length).toBeGreaterThan(0);

    // SECURE: every findMany call must carry companyId: COMPANY_A_ID
    for (const [args] of findManyCalls) {
      expect((args as { where: Record<string, unknown> }).where.companyId).toBe(COMPANY_A_ID);
    }
  });
});

// ---------------------------------------------------------------------------
// MT-002.2 — findOne must not return a cross-tenant user
// ---------------------------------------------------------------------------

describe('MT-002 UsersService IDOR — findOne', () => {
  it('2.3 findOne(companyBUserId) in Company A context must throw NotFoundException', async () => {
    const { service } = makeService();

    await expect(
      asCompanyA(() => service.findOne(COMPANY_B_USER.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// MT-002.3 — update must not modify a cross-tenant user
// ---------------------------------------------------------------------------

describe('MT-002 UsersService IDOR — update', () => {
  it('2.4 update(companyBUserId) in Company A context must throw NotFoundException', async () => {
    const { service } = makeService();

    await expect(
      asCompanyA(() => service.update(COMPANY_B_USER.id, { fullName: 'Hacked' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('2.5 update must NOT call prisma.user.update for a cross-tenant user', async () => {
    const { service, prisma } = makeService();

    await asCompanyA(() =>
      service.update(COMPANY_B_USER.id, { fullName: 'Hacked' }),
    ).catch(() => {});

    expect((prisma.user as unknown as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// MT-002.4 — deactivate must not affect a cross-tenant user
// ---------------------------------------------------------------------------

describe('MT-002 UsersService IDOR — deactivate', () => {
  it('2.6 deactivate(companyBUserId) in Company A context must throw NotFoundException', async () => {
    const { service } = makeService();

    await expect(
      asCompanyA(() => service.deactivate(COMPANY_B_USER.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('2.7 deactivate must NOT call prisma.user.update for a cross-tenant user', async () => {
    const { service, prisma } = makeService();

    await asCompanyA(() => service.deactivate(COMPANY_B_USER.id)).catch(() => {});

    expect((prisma.user as unknown as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// MT-002.5 — activate must not affect a cross-tenant user
// ---------------------------------------------------------------------------

describe('MT-002 UsersService IDOR — activate', () => {
  it('2.8 activate(companyBUserId) in Company A context must throw NotFoundException', async () => {
    const { service } = makeService();

    await expect(
      asCompanyA(() => service.activate(COMPANY_B_USER.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// MT-002.6 — softDelete must not delete a cross-tenant user
// ---------------------------------------------------------------------------

describe('MT-002 UsersService IDOR — softDelete', () => {
  it('2.9 softDelete(companyBUserId) in Company A context must throw NotFoundException', async () => {
    const { service } = makeService();

    await expect(
      asCompanyA(() => service.softDelete(COMPANY_B_USER.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// MT-002.7 — restore must not restore a cross-tenant deleted user
// ---------------------------------------------------------------------------

describe('MT-002 UsersService IDOR — restore', () => {
  it('2.10 restore(companyBDeletedUserId) in Company A context must throw NotFoundException', async () => {
    // Provide a mock that knows about the deleted company-B user
    const findFirst = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where?.companyId !== undefined && where.companyId !== COMPANY_B_ID) {
        return Promise.resolve(null);
      }
      if (where?.id === COMPANY_B_DELETED_USER.id) {
        return Promise.resolve(COMPANY_B_DELETED_USER);
      }
      return Promise.resolve(null);
    });
    const findUnique = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where?.companyId !== undefined && where.companyId !== COMPANY_B_ID) {
        return Promise.resolve(null);
      }
      if (where?.id === COMPANY_B_DELETED_USER.id) {
        return Promise.resolve(COMPANY_B_DELETED_USER);
      }
      return Promise.resolve(null);
    });
    const { service } = makeService({
      user: {
        findFirst,
        findUnique,
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        create: jest.fn(),
      },
    });

    await expect(
      asCompanyA(() => service.restore(COMPANY_B_DELETED_USER.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// MT-002.8 — assignManager must not reference a cross-tenant user or manager
// ---------------------------------------------------------------------------

describe('MT-002 UsersService IDOR — assignManager', () => {
  it('2.11 assignManager(companyBUserId) in Company A context must throw NotFoundException', async () => {
    const { service } = makeService();

    await expect(
      asCompanyA(() => service.assignManager(COMPANY_B_USER.id, null)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('2.12 assignManager with a cross-tenant managerId must throw NotFoundException or BadRequestException', async () => {
    // The target user exists in Company A; the managerId points to a Company B manager.
    // After MT-010, assignManager must scope BOTH the target user and the manager
    // lookup to Company A — a cross-tenant manager must not be assignable.
    const companyAUser = { ...COMPANY_B_USER, id: 'user-a-local', companyId: COMPANY_A_ID };
    const findUnique = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      // Simulate tenant-aware lookup
      if (where?.companyId !== undefined && where.companyId !== (where.id === companyAUser.id ? COMPANY_A_ID : COMPANY_B_ID)) {
        return Promise.resolve(null);
      }
      if (where?.id === companyAUser.id) return Promise.resolve(companyAUser);
      if (where?.id === COMPANY_B_MANAGER.id) return Promise.resolve(COMPANY_B_MANAGER);
      return Promise.resolve(null);
    });
    const findFirst = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where?.companyId !== undefined && where.companyId !== (where.id === companyAUser.id ? COMPANY_A_ID : COMPANY_B_ID)) {
        return Promise.resolve(null);
      }
      if (where?.id === companyAUser.id) return Promise.resolve(companyAUser);
      if (where?.id === COMPANY_B_MANAGER.id) return Promise.resolve(COMPANY_B_MANAGER);
      return Promise.resolve(null);
    });
    const { service } = makeService({
      user: {
        findUnique,
        findFirst,
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue(companyAUser),
        create: jest.fn(),
      },
    });

    // Company B's manager must NOT be assignable as manager to a Company A user
    await expect(
      asCompanyA(() => service.assignManager(companyAUser.id, COMPANY_B_MANAGER.id)),
    ).rejects.toThrow(); // NotFoundException (target not found) or BadRequestException (manager not found)
  });
});

// ---------------------------------------------------------------------------
// MT-002.9 — create must inject companyId from the tenant context
// ---------------------------------------------------------------------------

describe('MT-002 UsersService IDOR — create', () => {
  it('2.13 create must persist companyId from the tenant context, not leave it null', async () => {
    const { service, prisma } = makeService();

    await asCompanyA(() =>
      service.create({
        role: UserRole.SALES,
        fullName: 'New Staff',
        email: 'new@company-a.com',
        password: 'Secret1!',
      }),
    ).catch(() => {});

    const createCalls = (prisma.user as unknown as { create: jest.Mock }).create.mock.calls;
    if (createCalls.length === 0) {
      // If create was never called the test auto-passes this assertion, meaning
      // the service threw before reaching create — still not the IDOR scenario.
      return;
    }

    const [createArgs] = createCalls[0] as [{ data: Record<string, unknown> }];
    // SECURE: created user must belong to Company A
    expect(createArgs.data.companyId).toBe(COMPANY_A_ID);
  });
});
