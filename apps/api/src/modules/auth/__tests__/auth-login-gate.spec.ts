import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth.service';

jest.mock('argon2', () => ({
  verify: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

/**
 * Email/password login gate (Batch 10): MAINTENANCE_SUPERVISOR is staff and may
 * log in with email + password. Phone-only roles (CLIENT/CUSTOMER) still can't.
 */
describe('AuthService · email login role gate', () => {
  function makeService(role: UserRole) {
    const user = {
      id: 'u-1',
      role,
      active: true,
      passwordHash: 'hashed',
      fullName: 'Test',
      email: 'x@example.com',
      phone: null,
      locale: 'ar',
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        findMany: jest.fn().mockResolvedValue([user]),
        update: jest.fn().mockResolvedValue(user),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('secret'),
      get: jest.fn().mockImplementation((k: string) => (k.includes('REFRESH') ? '30d' : '15m')),
    };
    const sms = {};
    const caps = { hasCapability: jest.fn().mockResolvedValue(true) };
    const service = new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      sms as never,
      { sendPasswordReset: jest.fn() } as never,
      caps as never,
    );
    return { service, prisma };
  }

  it('allows a MAINTENANCE_SUPERVISOR to log in with email/password', async () => {
    const { service } = makeService(UserRole.MAINTENANCE_SUPERVISOR);
    const res = await service.loginEmail('x@example.com', 'MaintenancePass123!');
    expect(res.tokens.accessToken).toBe('access-token');
    expect(res.user?.role).toBe(UserRole.MAINTENANCE_SUPERVISOR);
  });

  it('picks the account whose password matches when the email exists in two companies', async () => {
    const argon2 = jest.requireMock('argon2') as { verify: jest.Mock };
    const { service, prisma } = makeService(UserRole.SALES);
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'in-a', role: UserRole.SALES, active: true, passwordHash: 'hash-a', company: null },
      { id: 'in-b', role: UserRole.SALES, active: true, passwordHash: 'hash-b', company: null },
    ]);
    argon2.verify.mockImplementation(async (hash: string) => hash === 'hash-b');
    try {
      await service.loginEmail('x@example.com', 'pw');
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'in-b' } }));
    } finally {
      argon2.verify.mockResolvedValue(true);
    }
  });

  it('refuses to guess when the same email and password open accounts in two companies', async () => {
    const { service, prisma } = makeService(UserRole.SALES);
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'in-a', role: UserRole.SALES, active: true, passwordHash: 'h', company: null },
      { id: 'in-b', role: UserRole.SALES, active: true, passwordHash: 'h', company: null },
    ]);
    await expect(service.loginEmail('x@example.com', 'pw')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TENANT_REQUIRED' }),
    });
  });

  it('still rejects phone-only roles (CLIENT) at the email gate', async () => {
    const { service } = makeService(UserRole.CLIENT);
    await expect(service.loginEmail('x@example.com', 'whatever')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
