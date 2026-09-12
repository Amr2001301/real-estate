/**
 * MT-034 — Auth service lifecycle enforcement matrix (D2 fix)
 *
 * Verifies lifecycle checks at the token-issuance boundary:
 *
 *  loginStaff:         ACTIVE → allowed, SUSPENDED → denied  (was covered in phase-c-tenant-auth.spec.ts)
 *  loginCustomerV2:    ACTIVE → allowed, SUSPENDED/ARCHIVED → denied
 *  registerCustomerV2: ACTIVE → allowed, SUSPENDED → denied
 *  refresh:            ACTIVE → allowed, SUSPENDED → denied; SUPER_ADMIN unaffected
 *  loginSuperAdmin:    unaffected by lifecycle
 *  logout:             always usable (not lifecycle-gated)
 *
 * Section 17 of the D2 acceptance spec.
 */

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$hashed'),
  verify: jest.fn().mockResolvedValue(true),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const COMPANY_A = 'comp-lifecycle-a';

function makeAuthService(userRow: Record<string, unknown> | null, overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(userRow),
      findFirst: jest.fn().mockResolvedValue(userRow),
      update: jest.fn().mockResolvedValue(userRow),
      create: jest.fn().mockResolvedValue({ ...userRow, id: 'new-id' }),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ lifecycleStatus: 'ACTIVE' }),
    },
    refreshToken: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    otpCode: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };

  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('secret'),
    get: jest.fn().mockImplementation((k: string) => (k.includes('REFRESH') ? '30d' : '15m')),
  };
  const sms = { sendOtp: jest.fn() };
  const email = { sendPasswordReset: jest.fn() };

  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    sms as never,
    email as never,
  );
  return { service, prisma };
}

function makeCustomerUser(lifecycleStatus = 'ACTIVE') {
  return {
    id: 'user-1',
    role: 'CLIENT',
    active: true,
    passwordHash: '$hashed',
    email: 'customer@acme.com',
    companyId: COMPANY_A,
    company: { lifecycleStatus },
  };
}

// ── loginCustomerV2 ───────────────────────────────────────────────────────────

describe('loginCustomerV2 — lifecycle enforcement', () => {
  test('ACTIVE company → login succeeds', async () => {
    const { service } = makeAuthService(makeCustomerUser('ACTIVE'));
    const result = await service.loginCustomerV2(COMPANY_A, 'customer@acme.com', 'Pass123!');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  test('SUSPENDED company → throws ForbiddenException with COMPANY_NOT_ACTIVE', async () => {
    const { service } = makeAuthService(makeCustomerUser('SUSPENDED'));
    await expect(
      service.loginCustomerV2(COMPANY_A, 'customer@acme.com', 'Pass123!'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COMPANY_NOT_ACTIVE' }),
    });
  });

  test('ARCHIVED company → throws ForbiddenException', async () => {
    const { service } = makeAuthService(makeCustomerUser('ARCHIVED'));
    await expect(
      service.loginCustomerV2(COMPANY_A, 'customer@acme.com', 'Pass123!'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('user not found → UnauthorizedException (not lifecycle-related)', async () => {
    const { service } = makeAuthService(null);
    await expect(
      service.loginCustomerV2(COMPANY_A, 'nobody@acme.com', 'Pass123!'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// ── registerCustomerV2 ────────────────────────────────────────────────────────

describe('registerCustomerV2 — lifecycle enforcement', () => {
  const registerDto = { fullName: 'New User', phone: '+966501234567', email: 'new@acme.com', password: 'Pass123!' };

  test('ACTIVE company → registration proceeds (no lifecycle error)', async () => {
    const { service, prisma } = makeAuthService(null);
    // No matching user: prisma.user.findFirst returns null → creates new user
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-user-id', role: 'CLIENT', companyId: COMPANY_A,
      email: 'new@acme.com', phone: '+966501234567', fullName: 'New User',
    });
    prisma.company.findUnique.mockResolvedValue({ lifecycleStatus: 'ACTIVE' });

    const result = await service.registerCustomerV2(COMPANY_A, 'SA', registerDto);
    expect(result.tokens.accessToken).toBe('access-token');
  });

  test('SUSPENDED company → throws ForbiddenException with COMPANY_NOT_ACTIVE', async () => {
    const { service, prisma } = makeAuthService(null);
    prisma.company.findUnique.mockResolvedValue({ lifecycleStatus: 'SUSPENDED' });

    await expect(
      service.registerCustomerV2(COMPANY_A, 'SA', registerDto),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COMPANY_NOT_ACTIVE' }),
    });
  });

  test('ARCHIVED company → throws ForbiddenException', async () => {
    const { service, prisma } = makeAuthService(null);
    prisma.company.findUnique.mockResolvedValue({ lifecycleStatus: 'ARCHIVED' });

    await expect(
      service.registerCustomerV2(COMPANY_A, 'SA', registerDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('company not found → throws ForbiddenException (fail closed)', async () => {
    const { service, prisma } = makeAuthService(null);
    prisma.company.findUnique.mockResolvedValue(null);

    await expect(
      service.registerCustomerV2(COMPANY_A, 'SA', registerDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── refresh ───────────────────────────────────────────────────────────────────

describe('refresh — lifecycle enforcement', () => {
  test('ACTIVE company → refresh succeeds', async () => {
    const { service } = makeAuthService({
      id: 'user-1', role: 'ADMIN', active: true, companyId: COMPANY_A,
      company: { lifecycleStatus: 'ACTIVE' },
    });
    const result = await service.refresh('valid-refresh-token');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  test('SUSPENDED company → refresh denied with COMPANY_NOT_ACTIVE', async () => {
    const { service } = makeAuthService({
      id: 'user-1', role: 'ADMIN', active: true, companyId: COMPANY_A,
      company: { lifecycleStatus: 'SUSPENDED' },
    });
    await expect(service.refresh('valid-refresh-token')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COMPANY_NOT_ACTIVE' }),
    });
  });

  test('ARCHIVED company → refresh denied', async () => {
    const { service } = makeAuthService({
      id: 'user-1', role: 'SALES', active: true, companyId: COMPANY_A,
      company: { lifecycleStatus: 'ARCHIVED' },
    });
    await expect(service.refresh('valid-refresh-token')).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('SUPER_ADMIN refresh is unaffected by lifecycle (no company)', async () => {
    const { service } = makeAuthService({
      id: 'sa-1', role: 'SUPER_ADMIN', active: true, companyId: null,
      company: null,
    });
    const result = await service.refresh('valid-refresh-token');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  test('invalid/expired refresh token → UnauthorizedException (not lifecycle)', async () => {
    const { service, prisma } = makeAuthService({
      id: 'user-1', role: 'ADMIN', active: true, companyId: COMPANY_A,
      company: { lifecycleStatus: 'SUSPENDED' },
    });
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test('legacy CLIENT with null companyId + DEFAULT company ACTIVE → refresh allowed', async () => {
    process.env.DEFAULT_COMPANY_ID = 'default-co';
    process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'false';

    const { service, prisma } = makeAuthService({
      id: 'user-1', role: 'CLIENT', active: true, companyId: null,
      company: null,
    });
    prisma.company.findUnique.mockResolvedValue({ lifecycleStatus: 'ACTIVE' });

    const result = await service.refresh('valid-refresh-token');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  test('legacy CLIENT with null companyId + DEFAULT company SUSPENDED → refresh denied', async () => {
    process.env.DEFAULT_COMPANY_ID = 'default-co';
    process.env.DISABLE_DEFAULT_COMPANY_FALLBACK = 'false';

    const { service, prisma } = makeAuthService({
      id: 'user-1', role: 'CLIENT', active: true, companyId: null,
      company: null,
    });
    prisma.company.findUnique.mockResolvedValue({ lifecycleStatus: 'SUSPENDED' });

    await expect(service.refresh('valid-refresh-token')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COMPANY_NOT_ACTIVE' }),
    });
  });
});

// ── loginSuperAdmin — unaffected ──────────────────────────────────────────────

describe('loginSuperAdmin — lifecycle does not apply', () => {
  test('SUPER_ADMIN login succeeds regardless of company state', async () => {
    const superAdminRow = {
      id: 'sa-1', role: 'SUPER_ADMIN', active: true, passwordHash: '$hashed',
      companyId: null, email: 'admin@platform.com',
    };
    const { service, prisma } = makeAuthService(superAdminRow);
    // Even if a company lookup returned SUSPENDED — SUPER_ADMIN has no company
    prisma.company.findUnique.mockResolvedValue({ lifecycleStatus: 'SUSPENDED' });
    prisma.user.findFirst.mockResolvedValue(superAdminRow);

    const result = await service.loginSuperAdmin('admin@platform.com', 'Pass123!');
    expect(result.tokens.accessToken).toBe('access-token');
  });
});

// ── logout — always usable ────────────────────────────────────────────────────

describe('logout — always usable (no lifecycle gate)', () => {
  test('logout succeeds regardless of company lifecycle (revokes token only)', async () => {
    const { service } = makeAuthService(null);
    const result = await service.logout('any-refresh-token');
    expect(result.ok).toBe(true);
  });
});
