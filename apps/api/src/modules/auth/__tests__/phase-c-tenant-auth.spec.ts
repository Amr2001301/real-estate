/**
 * Phase C-Expand unit tests — MT-025 / MT-026 / MT-027 / MT-028 / MT-029 / MT-030
 *
 * Tests the new tenant-aware auth service methods and TenantResolverService.
 * All tests use mocked Prisma. No real DB connection required.
 *
 * Baseline: 104 suites / 102 passing per B-Early acceptance.
 */

import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthService } from '../auth.service';
import { TenantResolverService } from '../tenant-resolver.service';

// ── Argon2 mock ──────────────────────────────────────────────────────────────

jest.mock('argon2', () => ({
  verify: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('$hashed'),
}));

// ── Shared helpers ───────────────────────────────────────────────────────────

const COMPANY_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const COMPANY_B = 'bbbbbbbb-0000-0000-0000-000000000001';

function makeAuthService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({ id: 'u-1', role: 'CLIENT', fullName: 'User', email: null, phone: null, locale: 'ar', active: true, emailVerifiedAt: null, companyId: COMPANY_A }),
      create: jest.fn(),
      update: jest.fn(),
    },
    otpCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    // MT-034: registerCustomerV2 and registerCustomerV2 lifecycle check calls prisma.company.findUnique.
    company: { findUnique: jest.fn().mockResolvedValue({ lifecycleStatus: 'ACTIVE' }) },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
    },
    emailVerificationToken: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    passwordResetToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
    ...overrides,
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('secret'),
    get: jest.fn().mockImplementation((k: string) => (k.includes('REFRESH') ? '30d' : '15m')),
  };
  const sms = { sendOtp: jest.fn().mockResolvedValue(undefined) };
  const email = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
  const caps = { hasCapability: jest.fn().mockResolvedValue(true) };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    sms as never,
    email as never,
    caps as never,
  );
  return { service, prisma, sms, email };
}

function makeResolverService(company: Record<string, unknown> | null) {
  const prisma = {
    company: {
      findUnique: jest.fn().mockResolvedValue(company),
    },
  };
  return new TenantResolverService(prisma as never);
}

// ── MT-025 — TenantResolverService ───────────────────────────────────────────

describe('TenantResolverService · resolveBySlug', () => {
  it('returns companyId, slug, country, isActive for a known active company', async () => {
    const resolver = makeResolverService({
      id: COMPANY_A,
      slug: 'acme',
      country: 'SA',
      isActive: true,
    });
    const result = await resolver.resolveBySlug('acme');
    expect(result.companyId).toBe(COMPANY_A);
    expect(result.slug).toBe('acme');
    expect(result.country).toBe('SA');
    expect(result.isActive).toBe(true);
  });

  it('normalises slug to lowercase before querying', async () => {
    const resolver = makeResolverService({
      id: COMPANY_A,
      slug: 'acme',
      country: 'SA',
      isActive: true,
    });
    const prisma = (resolver as unknown as { prisma: { company: { findUnique: jest.Mock } } }).prisma;
    await resolver.resolveBySlug('ACME');
    expect(prisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'acme' } }),
    );
  });

  it('throws NotFoundException for an unknown slug', async () => {
    const resolver = makeResolverService(null);
    await expect(resolver.resolveBySlug('no-such-company')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException for an inactive company (non-leaking)', async () => {
    const resolver = makeResolverService({
      id: COMPANY_A,
      slug: 'inactive',
      country: 'SA',
      isActive: false,
    });
    await expect(resolver.resolveBySlug('inactive')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('tryResolveBySlug returns null for unknown slug instead of throwing', async () => {
    const resolver = makeResolverService(null);
    const result = await resolver.tryResolveBySlug('unknown');
    expect(result).toBeNull();
  });

  it('defaults country to SA when company.country is null', async () => {
    const resolver = makeResolverService({
      id: COMPANY_A,
      slug: 'no-country',
      country: null,
      isActive: true,
    });
    const result = await resolver.resolveBySlug('no-country');
    expect(result.country).toBe('SA');
  });
});

// ── MT-026 — loginStaff ───────────────────────────────────────────────────────

describe('AuthService · loginStaff', () => {
  function makeStaffUser(role: string, overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'staff-1',
      role,
      email: 'staff@acme.com',
      companyId: COMPANY_A,
      active: true,
      passwordHash: 'hashed',
      company: { subscriptionStatus: 'ACTIVE', subscriptionEndAt: null, lifecycleStatus: 'ACTIVE' },
      ...overrides,
    };
  }

  it('allows ADMIN to log in via loginStaff', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(makeStaffUser('ADMIN'));
    prisma.user.update.mockResolvedValue({});
    const result = await service.loginStaff(COMPANY_A, 'staff@acme.com', 'Password1!');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  it('allows SALES_MANAGER to log in via loginStaff', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(makeStaffUser('SALES_MANAGER'));
    prisma.user.update.mockResolvedValue({});
    const result = await service.loginStaff(COMPANY_A, 'staff@acme.com', 'Password1!');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  it('rejects CLIENT via loginStaff', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(makeStaffUser('CLIENT'));
    await expect(service.loginStaff(COMPANY_A, 'staff@acme.com', 'Password1!')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects SUPER_ADMIN via loginStaff', async () => {
    const { service, prisma } = makeAuthService();
    // SUPER_ADMIN with companyId should never exist, but the role check fires first.
    prisma.user.findFirst.mockResolvedValue(makeStaffUser('SUPER_ADMIN'));
    await expect(service.loginStaff(COMPANY_A, 'staff@acme.com', 'Password1!')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('queries by companyId + canonicalEmail — cross-tenant user is not found', async () => {
    const { service, prisma } = makeAuthService();
    // Company B staff is invisible when we query for Company A.
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.loginStaff(COMPANY_A, 'other-company-staff@acme.com', 'pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_A }),
      }),
    );
  });

  it('rejects suspended company', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(
      makeStaffUser('ADMIN', { company: { subscriptionStatus: 'SUSPENDED', subscriptionEndAt: null } }),
    );
    await expect(service.loginStaff(COMPANY_A, 'staff@acme.com', 'Password1!')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects inactive user', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(makeStaffUser('ADMIN', { active: false }));
    await expect(service.loginStaff(COMPANY_A, 'staff@acme.com', 'Password1!')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('normalises email before lookup (canonical lowercase)', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(makeStaffUser('ADMIN'));
    prisma.user.update.mockResolvedValue({});
    await service.loginStaff(COMPANY_A, '  STAFF@Acme.COM  ', 'Password1!');
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: 'staff@acme.com' }),
      }),
    );
  });
});

// ── MT-027 — loginSuperAdmin ──────────────────────────────────────────────────

describe('AuthService · loginSuperAdmin', () => {
  const superAdmin = {
    id: 'sa-1',
    role: 'SUPER_ADMIN',
    email: 'root@platform.com',
    companyId: null,
    active: true,
    passwordHash: 'hashed',
  };

  it('allows SUPER_ADMIN with companyId=null to log in', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(superAdmin);
    prisma.user.update.mockResolvedValue({});
    const result = await service.loginSuperAdmin('root@platform.com', 'StrongPass1!');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  it('queries with role=SUPER_ADMIN AND companyId=null', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(superAdmin);
    prisma.user.update.mockResolvedValue({});
    await service.loginSuperAdmin('root@platform.com', 'StrongPass1!');
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'SUPER_ADMIN', companyId: null }),
      }),
    );
  });

  it('rejects ADMIN (wrong role)', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.loginSuperAdmin('admin@acme.com', 'pass')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects inactive super-admin', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue({ ...superAdmin, active: false });
    await expect(service.loginSuperAdmin('root@platform.com', 'pass')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

// ── MT-028 — loginCustomerV2 ──────────────────────────────────────────────────

describe('AuthService · loginCustomerV2', () => {
  const customer = {
    id: 'cust-1',
    role: 'CLIENT',
    email: 'customer@example.com',
    companyId: COMPANY_A,
    active: true,
    passwordHash: 'hashed',
  };

  it('allows CLIENT to log in within the correct company', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(customer);
    prisma.user.update.mockResolvedValue({});
    const result = await service.loginCustomerV2(COMPANY_A, 'customer@example.com', 'pass');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  it('cross-tenant login returns 401 (user not visible in other company)', async () => {
    const { service, prisma } = makeAuthService();
    // Company B returns no user for the Company A customer's email.
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.loginCustomerV2(COMPANY_B, 'customer@example.com', 'pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_B }),
      }),
    );
  });

  it('rejects ADMIN role via loginCustomerV2 without leaking role information', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue({ ...customer, role: 'ADMIN' });
    await expect(
      service.loginCustomerV2(COMPANY_A, 'customer@example.com', 'pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive customer', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue({ ...customer, active: false });
    await expect(
      service.loginCustomerV2(COMPANY_A, 'customer@example.com', 'pass'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── MT-029 — registerCustomerV2 ───────────────────────────────────────────────

describe('AuthService · registerCustomerV2', () => {
  const regDto = { fullName: 'Alice', phone: '+966500000001', email: 'alice@example.com', password: 'Pass1234!' };

  it('creates a new CLIENT with server-provided companyId', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u-new', role: 'CLIENT', ...regDto, companyId: COMPANY_A });
    prisma.user.update.mockResolvedValue({});
    const result = await service.registerCustomerV2(COMPANY_A, 'SA', regDto);
    expect(result.tokens.accessToken).toBe('access-token');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: COMPANY_A, role: 'CLIENT' }),
      }),
    );
  });

  it('rejects if email is already taken in this company', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst
      .mockResolvedValueOnce({ id: 'existing', role: 'CLIENT', passwordHash: 'h' }) // byEmail
      .mockResolvedValueOnce(null); // byPhone
    await expect(service.registerCustomerV2(COMPANY_A, 'SA', regDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects invalid phone (non-E.164 without country hint parseable by SA)', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(null);
    const badDto = { ...regDto, phone: 'not-a-phone' };
    await expect(service.registerCustomerV2(COMPANY_A, 'SA', badDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('companyId cannot be overridden via the DTO — always uses server-resolved value', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u-new', role: 'CLIENT', companyId: COMPANY_A });
    prisma.user.update.mockResolvedValue({});
    // Even if a malicious payload somehow added companyId, it is ignored — the method
    // signature does not accept it.
    await service.registerCustomerV2(COMPANY_A, 'SA', regDto);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: COMPANY_A }),
      }),
    );
  });
});

// ── MT-030 — requestOtpV2 / verifyOtpV2 ──────────────────────────────────────

describe('AuthService · requestOtpV2', () => {
  it('creates OtpCode with companyId for a valid phone', async () => {
    const { service, prisma, sms } = makeAuthService();
    prisma.otpCode.findFirst.mockResolvedValue(null); // no recent OTP
    prisma.otpCode.create.mockResolvedValue({});
    await service.requestOtpV2(COMPANY_A, 'SA', '+966500000001');
    expect(prisma.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: COMPANY_A, phone: '+966500000001' }),
      }),
    );
    expect(sms.sendOtp).toHaveBeenCalledWith('+966500000001', expect.any(String));
  });

  it('OTP for Tenant A is not visible to Tenant B query', async () => {
    const { service, prisma } = makeAuthService();
    // Tenant B query finds no recent OTP (Company A OTP is not in B's scope).
    prisma.otpCode.findFirst.mockResolvedValue(null);
    prisma.otpCode.create.mockResolvedValue({});
    await service.requestOtpV2(COMPANY_B, 'SA', '+966500000001');
    // The create call stores Company B's companyId, not Company A's.
    expect(prisma.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: COMPANY_B }),
      }),
    );
  });

  it('rejects invalid phone number', async () => {
    const { service } = makeAuthService();
    await expect(service.requestOtpV2(COMPANY_A, 'SA', 'not-valid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects request within 60-second cooldown', async () => {
    const { service, prisma } = makeAuthService();
    prisma.otpCode.findFirst.mockResolvedValue({ id: 'otp-recent', createdAt: new Date() });
    await expect(service.requestOtpV2(COMPANY_A, 'SA', '+966500000001')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('AuthService · verifyOtpV2', () => {
  function makeOtp(code: string, overrides: Partial<Record<string, unknown>> = {}) {
    const codeHash = createHash('sha256').update(code).digest('hex');
    return {
      id: 'otp-1',
      phone: '+966500000001',
      companyId: COMPANY_A,
      codeHash,
      consumed: false,
      attempts: 0,
      expiresAt: new Date(Date.now() + 600_000),
      ...overrides,
    };
  }

  it('verifies a valid code and returns tokens for existing user', async () => {
    const { service, prisma } = makeAuthService();
    prisma.otpCode.findFirst.mockResolvedValue(makeOtp('123456'));
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue({
      id: 'u-1',
      role: 'CLIENT',
      companyId: COMPANY_A,
      phone: '+966500000001',
    });
    prisma.user.update.mockResolvedValue({});
    const result = await service.verifyOtpV2(COMPANY_A, 'SA', '+966500000001', '123456');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  it('creates a new user when none exists', async () => {
    const { service, prisma } = makeAuthService();
    prisma.otpCode.findFirst.mockResolvedValue(makeOtp('999999'));
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue(null); // no existing user
    prisma.user.create.mockResolvedValue({ id: 'u-new', role: 'CLIENT', companyId: COMPANY_A });
    const result = await service.verifyOtpV2(COMPANY_A, 'SA', '+966500000001', '999999');
    expect(result.tokens.accessToken).toBe('access-token');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: COMPANY_A }),
      }),
    );
  });

  it('OTP issued for Tenant A cannot be consumed by Tenant B query', async () => {
    const { service, prisma } = makeAuthService();
    // Company B query returns no OTP (Company A's OTP has Company A's companyId).
    prisma.otpCode.findFirst.mockResolvedValue(null);
    await expect(service.verifyOtpV2(COMPANY_B, 'SA', '+966500000001', '123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.otpCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_B }),
      }),
    );
  });

  it('rejects wrong code and increments attempts', async () => {
    const { service, prisma } = makeAuthService();
    prisma.otpCode.findFirst.mockResolvedValue(makeOtp('123456'));
    prisma.otpCode.update.mockResolvedValue({});
    await expect(
      service.verifyOtpV2(COMPANY_A, 'SA', '+966500000001', '000000'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempts: { increment: 1 } }),
      }),
    );
  });
});

// ── MT-030 — forgotPasswordV2 ─────────────────────────────────────────────────

describe('AuthService · forgotPasswordV2', () => {
  it('returns ok:true for a known email', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue({
      id: 'u-1',
      email: 'user@acme.com',
      passwordHash: 'h',
      active: true,
    });
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.create.mockResolvedValue({});
    const result = await service.forgotPasswordV2(COMPANY_A, 'user@acme.com');
    expect(result).toEqual({ ok: true });
  });

  it('returns ok:true for an unknown email (enumeration-safe)', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(null);
    const result = await service.forgotPasswordV2(COMPANY_A, 'ghost@example.com');
    expect(result).toEqual({ ok: true });
  });

  it('queries within the specified company (tenant-scoped)', async () => {
    const { service, prisma } = makeAuthService();
    prisma.user.findFirst.mockResolvedValue(null);
    await service.forgotPasswordV2(COMPANY_A, 'user@acme.com');
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_A }),
      }),
    );
  });
});

// ── MT-030 — OtpCode TENANT_CONTROLLED classification ────────────────────────

describe('MODEL_TENANCY OtpCode classification', () => {
  it('OtpCode is classified as TENANT_CONTROLLED', () => {
    const { MODEL_TENANCY } = jest.requireActual<typeof import('../../../common/prisma/model-tenancy')>(
      '../../../common/prisma/model-tenancy',
    );
    expect(MODEL_TENANCY['OtpCode']).toBe('TENANT_CONTROLLED');
  });
});
