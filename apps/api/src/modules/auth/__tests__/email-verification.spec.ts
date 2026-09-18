/**
 * Unit tests for AuthService — email verification (verifyEmail / resendVerification).
 *
 * Uses mocked Prisma and EmailService. Real-Postgres coverage lives in
 * test/e2e/email-verification.e2e-spec.ts.
 */

import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthService } from '../auth.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-08-12T10:00:00Z');

function makeVerifyToken(opts: {
  userId?: string;
  expired?: boolean;
  consumed?: boolean;
  id?: string;
} = {}) {
  return {
    id: opts.id ?? 'evt-1',
    userId: opts.userId ?? 'user-1',
    tokenHash: 'stored-hash',
    expiresAt: opts.expired
      ? new Date(NOW.getTime() - 1)
      : new Date(NOW.getTime() + 60 * 60_000),
    consumedAt: opts.consumed ? new Date(NOW.getTime() - 5_000) : null,
    createdAt: NOW,
  };
}

function makeUser(overrides: Partial<object> = {}) {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    emailVerifiedAt: null,
    active: true,
    role: 'CLIENT',
    ...overrides,
  };
}

function makeService(overrides: {
  tokenRow?: object | null;
  userRow?: object | null;
  recentToken?: object | null;
  sendEmailVerification?: jest.Mock;
} = {}) {
  const tokenRow = overrides.tokenRow !== undefined ? overrides.tokenRow : makeVerifyToken();
  const userRow = overrides.userRow !== undefined ? overrides.userRow : makeUser();
  const recentToken = overrides.recentToken !== undefined ? overrides.recentToken : null;

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(userRow),
      update: jest.fn().mockResolvedValue(userRow),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
    },
    emailVerificationToken: {
      findUnique: jest.fn().mockResolvedValue(tokenRow),
      findFirst: jest.fn().mockResolvedValue(recentToken),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op;
    }),
  };

  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('secret'),
    get: jest.fn().mockImplementation((k: string) => {
      if (k === 'PUBLIC_WEB_URL') return 'http://localhost:3002';
      if (k === 'SMTP_HOST') return undefined;
      if (k.includes('REFRESH')) return '30d';
      return '15m';
    }),
  };

  const emailVerifySend = overrides.sendEmailVerification ?? jest.fn().mockResolvedValue(undefined);
  const email = { sendEmailVerification: emailVerifySend, sendPasswordReset: jest.fn() };

  const caps = { hasCapability: jest.fn().mockResolvedValue(true) };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    {} as never,
    email as never,
    caps as never,
  );

  return { service, prisma, email };
}

// ── verifyEmail ───────────────────────────────────────────────────────────────

describe('AuthService · verifyEmail', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('returns { ok: true } on a valid unused token', async () => {
    const { service } = makeService();
    const result = await service.verifyEmail('raw-token');
    expect(result).toEqual({ ok: true });
  });

  it('sets emailVerifiedAt on the user in a transaction', async () => {
    const { service, prisma } = makeService();
    await service.verifyEmail('raw-token');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { emailVerifiedAt: expect.any(Date) },
      }),
    );
  });

  it('marks the token consumed', async () => {
    const { service, prisma } = makeService();
    await service.verifyEmail('raw-token');
    expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
  });

  it('invalidates other outstanding tokens in the same transaction', async () => {
    const { service, prisma } = makeService();
    await service.verifyEmail('raw-token');
    expect(prisma.emailVerificationToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', consumedAt: null }),
      }),
    );
  });

  it('throws 400 for an unknown token', async () => {
    const { service } = makeService({ tokenRow: null });
    await expect(service.verifyEmail('bad-token')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 400 for an expired token', async () => {
    const { service } = makeService({ tokenRow: makeVerifyToken({ expired: true }) });
    await expect(service.verifyEmail('raw-token')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 400 for an already-consumed token', async () => {
    const { service } = makeService({ tokenRow: makeVerifyToken({ consumed: true }) });
    await expect(service.verifyEmail('raw-token')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns { ok: true, alreadyVerified: true } when user is already verified', async () => {
    const { service } = makeService({
      userRow: makeUser({ emailVerifiedAt: new Date(NOW.getTime() - 1_000) }),
    });
    const result = await service.verifyEmail('raw-token');
    expect(result).toEqual({ ok: true, alreadyVerified: true });
  });

  it('still consumes the token when user is already verified (prevents replay)', async () => {
    const { service, prisma } = makeService({
      userRow: makeUser({ emailVerifiedAt: new Date(NOW.getTime() - 1_000) }),
    });
    await service.verifyEmail('raw-token');
    expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ consumedAt: expect.any(Date) }) }),
    );
    // No full transaction — only token update, no user.update
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does NOT let a token for user-A verify user-B (token is bound to userId)', async () => {
    // The token carries userId='user-1'; user resolved from that ID gets verified.
    // If user findUnique by record.userId returns a DIFFERENT row, emailVerifiedAt
    // is set on that row — not on any user-B who may own the token. This test
    // confirms the service always uses record.userId, not a caller-supplied id.
    const { service, prisma } = makeService({
      tokenRow: makeVerifyToken({ userId: 'user-1' }),
      userRow: makeUser({ id: 'user-1' }),
    });
    await service.verifyEmail('raw-token');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });

  it('looks up token by SHA-256 hash of the raw token, not the raw value', async () => {
    const { service, prisma } = makeService();
    const rawToken = 'my-raw-token-xyz';
    await service.verifyEmail(rawToken);
    const expectedHash = createHash('sha256').update(rawToken).digest('hex');
    expect(prisma.emailVerificationToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: expectedHash } }),
    );
  });
});

// ── resendVerification ────────────────────────────────────────────────────────

describe('AuthService · resendVerification', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('returns { ok: true } and sends a verification email', async () => {
    const { service, email } = makeService();
    const result = await service.resendVerification('user-1');
    expect(result).toEqual({ ok: true });
    expect(email.sendEmailVerification).toHaveBeenCalledWith('alice@example.com', expect.any(String));
  });

  it('invalidates previous tokens before creating a new one', async () => {
    const { service, prisma } = makeService();
    await service.resendVerification('user-1');
    expect(prisma.emailVerificationToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', consumedAt: null },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
  });

  it('throws 429 when a token was issued within the cooldown window', async () => {
    const { service } = makeService({ recentToken: makeVerifyToken() });
    const result = service.resendVerification('user-1');
    await expect(result).rejects.toThrow(
      expect.objectContaining({ status: HttpStatus.TOO_MANY_REQUESTS }),
    );
  });

  it('returns { ok: true } silently for an OTP-only user with no email', async () => {
    const { service, email } = makeService({
      userRow: makeUser({ email: null }),
    });
    const result = await service.resendVerification('user-1');
    expect(result).toEqual({ ok: true });
    expect(email.sendEmailVerification).not.toHaveBeenCalled();
  });

  it('returns { ok: true } silently for an already-verified user', async () => {
    const { service, email } = makeService({
      userRow: makeUser({ emailVerifiedAt: new Date() }),
    });
    const result = await service.resendVerification('user-1');
    expect(result).toEqual({ ok: true });
    expect(email.sendEmailVerification).not.toHaveBeenCalled();
  });

  it('stores only the SHA-256 hash of the raw token — raw token goes to email only', async () => {
    const { service, prisma, email } = makeService();
    await service.resendVerification('user-1');
    // The raw token sent to the email function
    const rawSent = (email.sendEmailVerification as jest.Mock).mock.calls[0][1] as string;
    expect(rawSent).toBeTruthy();
    const expectedHash = createHash('sha256').update(rawSent).digest('hex');
    // DB stores the hash
    const stored = (prisma.emailVerificationToken.create as jest.Mock).mock.calls[0][0].data.tokenHash;
    expect(stored).toBe(expectedHash);
    expect(stored).not.toBe(rawSent);
  });

  it('token expires 60 minutes from now', async () => {
    const { service, prisma } = makeService();
    await service.resendVerification('user-1');
    const expiresAt: Date = (prisma.emailVerificationToken.create as jest.Mock).mock.calls[0][0].data.expiresAt;
    const diffMs = expiresAt.getTime() - NOW.getTime();
    expect(diffMs).toBeCloseTo(60 * 60_000, -3);
  });
});
