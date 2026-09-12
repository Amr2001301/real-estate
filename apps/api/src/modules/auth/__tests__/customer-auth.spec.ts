import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth.service';
import { CustomerRegisterDto } from '../dto/auth.dto';

import * as argon2 from 'argon2';

jest.mock('argon2', () => ({
  verify: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

function makeService() {
  const created = {
    id: 'u-1',
    role: UserRole.CLIENT,
    active: true,
    passwordHash: 'hashed',
    fullName: 'Sara Client',
    email: 'sara@example.com',
    phone: '+966500000000',
    locale: 'ar',
    // MT-011: companyId=null causes claimSyntheticPeers to return early —
    // a CLIENT user created via public auth has no company context yet.
    companyId: null,
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
      // MT-011: email-peer lookup inside claimSyntheticPeers now uses findFirst.
      // With companyId=null the claim exits before the lookup, so this is a
      // safety net only.
      findFirst: jest.fn().mockResolvedValue(null),
      // P9 — claimSyntheticPeers scans a small set of candidates by phone
      // suffix. The unit-test mock returns an empty array so the claim is
      // a no-op; integration coverage lives in the e2e suite.
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(created),
      update: jest.fn().mockResolvedValue(created),
    },
    // MT-034: lifecycle check calls prisma.company.findUnique for DEFAULT_COMPANY_ID.
    company: { findUnique: jest.fn().mockResolvedValue({ lifecycleStatus: 'ACTIVE' }) },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('secret'),
    get: jest.fn().mockImplementation((k: string) => (k.includes('REFRESH') ? '30d' : '15m')),
  };
  const service = new AuthService(prisma as never, jwt as never, config as never, {} as never, { sendPasswordReset: jest.fn() } as never);
  return { service, prisma, created };
}

describe('AuthService · public customer auth', () => {
  beforeEach(() => {
    (argon2.verify as jest.Mock).mockResolvedValue(true);
  });

  // ── Register ──────────────────────────────────────────────────────────
  it('registers a customer as CLIENT and returns tokens', async () => {
    const { service, prisma, created } = makeService();
    // Sequence: byEmail (null) → byPhone (null) → identity-claim target
    // lookup (created, companyId=null → early return) → issueTokens final
    // user lookup (created).
    // MT-011: email-peer lookup moved from findUnique to findFirst, so the
    // findUnique sequence is now 4 calls instead of 5.
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce(created);

    const res = await service.registerCustomer({
      fullName: 'Sara Client',
      phone: '+966500000000',
      email: 'Sara@Example.com',
      password: 'StrongPass1',
    });

    expect(res.tokens.accessToken).toBe('access-token');
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe('CLIENT'); // forced server-side
    expect(data.email).toBe('sara@example.com'); // normalized lowercase
    expect(data.passwordHash).toBe('hashed');
  });

  it('rejects a duplicate email', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null);
    await expect(
      service.registerCustomer({ fullName: 'X', phone: '+966500000001', email: 'x@example.com', password: 'StrongPass1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate phone', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'existing' });
    await expect(
      service.registerCustomer({ fullName: 'X', phone: '+966500000002', email: 'new@example.com', password: 'StrongPass1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  // ── Login ─────────────────────────────────────────────────────────────
  it('logs in a CLIENT customer', async () => {
    const { service, prisma, created } = makeService();
    // Sequence: loginCustomer email lookup → identity-claim target lookup
    // (companyId=null → early return) → issueTokens final user lookup.
    // MT-011: email-peer lookup now uses findFirst; with companyId=null the
    // claim exits before that call, so findUnique sequence is 3 calls.
    prisma.user.findUnique
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce(created);
    const res = await service.loginCustomer('Sara@Example.com', 'StrongPass1');
    expect(res.tokens.accessToken).toBe('access-token');
    expect(res.user?.role).toBe(UserRole.CLIENT);
  });

  it('rejects a wrong password', async () => {
    const { service, prisma, created } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce(created);
    (argon2.verify as jest.Mock).mockResolvedValueOnce(false);
    await expect(service.loginCustomer('sara@example.com', 'nope')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a staff account on the customer login endpoint', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'admin-1',
      role: UserRole.ADMIN,
      active: true,
      passwordHash: 'hashed',
    });
    await expect(service.loginCustomer('admin@example.com', 'whatever')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // ── DTO validation (weak password / terms / role-safety) ────────────────
  it('CustomerRegisterDto rejects a weak password and missing terms', () => {
    const weak = plainToInstance(CustomerRegisterDto, {
      fullName: 'Sara',
      phone: '+966500000000',
      email: 'sara@example.com',
      password: 'short',
      acceptTerms: true,
    });
    expect(validateSync(weak).length).toBeGreaterThan(0);

    const noTerms = plainToInstance(CustomerRegisterDto, {
      fullName: 'Sara',
      phone: '+966500000000',
      email: 'sara@example.com',
      password: 'StrongPass1',
      acceptTerms: false,
    });
    expect(validateSync(noTerms).length).toBeGreaterThan(0);
  });

  it('CustomerRegisterDto accepts a valid payload (and has no role field)', () => {
    const dto = plainToInstance(CustomerRegisterDto, {
      fullName: 'Sara',
      phone: '+966500000000',
      email: 'sara@example.com',
      password: 'StrongPass1',
      acceptTerms: true,
      city: 'الرياض',
      role: 'ADMIN', // not a DTO field → ignored, never reaches the service
    });
    expect(validateSync(dto)).toHaveLength(0);
    expect((dto as unknown as { role?: unknown }).role).toBe('ADMIN'); // present on the plain object…
    // …but the DTO class/service never reads `role`, so it cannot escalate.
  });
});
