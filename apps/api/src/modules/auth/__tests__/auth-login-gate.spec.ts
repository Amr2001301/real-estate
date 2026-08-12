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
    const service = new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      sms as never,
      { sendPasswordReset: jest.fn() } as never,
    );
    return { service, prisma };
  }

  it('allows a MAINTENANCE_SUPERVISOR to log in with email/password', async () => {
    const { service } = makeService(UserRole.MAINTENANCE_SUPERVISOR);
    const res = await service.loginEmail('x@example.com', 'MaintenancePass123!');
    expect(res.tokens.accessToken).toBe('access-token');
    expect(res.user?.role).toBe(UserRole.MAINTENANCE_SUPERVISOR);
  });

  it('still rejects phone-only roles (CLIENT) at the email gate', async () => {
    const { service } = makeService(UserRole.CLIENT);
    await expect(service.loginEmail('x@example.com', 'whatever')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
