/**
 * Unit tests for AuthService — forgotPassword / resetPassword.
 *
 * Uses mocked Prisma, argon2, and EmailService so every test is fast and
 * deterministic. Real-Postgres coverage lives in test/e2e/password-reset.e2e-spec.ts.
 */

import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { AuthService } from '../auth.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('argon2', () => ({
  verify: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed-new-password'),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-08-12T10:00:00Z');

function makeService(overrides: {
  userRow?: object | null;
  resetTokenRow?: object | null;
  sendPasswordReset?: jest.Mock;
} = {}) {
  const userRow = overrides.userRow !== undefined
    ? overrides.userRow
    : {
        id: 'user-1',
        email: 'alice@example.com',
        passwordHash: 'existing-hash',
        active: true,
      };

  const resetTokenRow = overrides.resetTokenRow !== undefined
    ? overrides.resetTokenRow
    : null;

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(userRow),
      update: jest.fn().mockResolvedValue(userRow),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    passwordResetToken: {
      findUnique: jest.fn().mockResolvedValue(resetTokenRow),
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
      if (k === 'PUBLIC_WEB_URL') return 'http://localhost:3001';
      if (k === 'SMTP_HOST') return undefined; // no SMTP → dev log only
      if (k.includes('REFRESH')) return '30d';
      return '15m';
    }),
  };
  const sms = {};
  const emailSend = overrides.sendPasswordReset ?? jest.fn().mockResolvedValue(undefined);
  const email = { sendPasswordReset: emailSend };

  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    sms as never,
    email as never,
  );

  return { service, prisma, email };
}

// ── forgotPassword ────────────────────────────────────────────────────────────

describe('AuthService · forgotPassword', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('returns { ok: true } when the email exists', async () => {
    const { service } = makeService();
    const result = await service.forgotPassword('Alice@Example.com');
    expect(result).toEqual({ ok: true });
  });

  it('normalises the email to lowercase before lookup', async () => {
    const { service, prisma } = makeService();
    await service.forgotPassword('Alice@Example.com');
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'alice@example.com' } }),
    );
  });

  it('creates a reset token record for an existing account', async () => {
    const { service, prisma } = makeService();
    await service.forgotPassword('alice@example.com');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });

  it('stores a SHA-256 hash — NOT the raw token', async () => {
    const { service, prisma, email } = makeService();
    await service.forgotPassword('alice@example.com');
    const stored = (prisma.passwordResetToken.create as jest.Mock).mock.calls[0][0].data.tokenHash;
    // Must be a 64-char hex string (SHA-256 output).
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    // The raw token was sent in the email. Derive its expected hash and confirm
    // the stored value matches — proving the service hashes before storing.
    const rawSentToEmail = (email.sendPasswordReset as jest.Mock).mock.calls[0][1] as string;
    const expectedHash = createHash('sha256').update(rawSentToEmail).digest('hex');
    expect(stored).toBe(expectedHash);
  });

  it('sends the password-reset email', async () => {
    const { service, email } = makeService();
    await service.forgotPassword('alice@example.com');
    expect(email.sendPasswordReset).toHaveBeenCalledWith(
      'alice@example.com',
      expect.any(String),
    );
  });

  it('invalidates previous active reset tokens before creating a new one', async () => {
    const { service, prisma } = makeService();
    await service.forgotPassword('alice@example.com');
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', consumedAt: null },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
  });

  it('returns { ok: true } for an unknown email (no enumeration)', async () => {
    const { service } = makeService({ userRow: null });
    const result = await service.forgotPassword('nobody@example.com');
    expect(result).toEqual({ ok: true });
  });

  it('does NOT create a token for an unknown email', async () => {
    const { service, prisma } = makeService({ userRow: null });
    await service.forgotPassword('nobody@example.com');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('does NOT send an email for an unknown address', async () => {
    const { service, email } = makeService({ userRow: null });
    await service.forgotPassword('nobody@example.com');
    expect(email.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('returns { ok: true } for an account with no password (OTP-only)', async () => {
    const { service, email } = makeService({
      userRow: { id: 'user-2', email: 'otp@example.com', passwordHash: null, active: true },
    });
    const result = await service.forgotPassword('otp@example.com');
    expect(result).toEqual({ ok: true });
    expect(email.sendPasswordReset).not.toHaveBeenCalled();
  });
});

// ── resetPassword ─────────────────────────────────────────────────────────────

describe('AuthService · resetPassword', () => {
  const RAW_TOKEN = 'a'.repeat(64); // 64 hex chars = 32 bytes raw

  function makeValidRecord(overrides: Partial<object> = {}) {
    return {
      id: 'prt-1',
      userId: 'user-1',
      tokenHash: 'will-be-overwritten-by-mock',
      expiresAt: new Date(NOW.getTime() + 10 * 60_000), // 10 min from now
      consumedAt: null,
      createdAt: NOW,
      ...overrides,
    };
  }

  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('returns { ok: true } on a valid token', async () => {
    const { service } = makeService({ resetTokenRow: makeValidRecord() });
    const result = await service.resetPassword(RAW_TOKEN, 'NewPass123!');
    expect(result).toEqual({ ok: true });
  });

  it('updates the password hash to the argon2-hashed new password', async () => {
    const { service, prisma } = makeService({ resetTokenRow: makeValidRecord() });
    await service.resetPassword(RAW_TOKEN, 'NewPass123!');
    expect(argon2.hash).toHaveBeenCalledWith('NewPass123!');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { passwordHash: 'hashed-new-password' } }),
    );
  });

  it('marks the reset token consumed', async () => {
    const { service, prisma } = makeService({ resetTokenRow: makeValidRecord() });
    await service.resetPassword(RAW_TOKEN, 'NewPass123!');
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prt-1' },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
  });

  it('revokes all active refresh tokens for the user', async () => {
    const { service, prisma } = makeService({ resetTokenRow: makeValidRecord() });
    await service.resetPassword(RAW_TOKEN, 'NewPass123!');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  it('rejects an expired token', async () => {
    const expired = makeValidRecord({ expiresAt: new Date(NOW.getTime() - 1) });
    const { service } = makeService({ resetTokenRow: expired });
    await expect(service.resetPassword(RAW_TOKEN, 'NewPass123!')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an already-consumed token', async () => {
    const consumed = makeValidRecord({ consumedAt: new Date(NOW.getTime() - 5 * 60_000) });
    const { service } = makeService({ resetTokenRow: consumed });
    await expect(service.resetPassword(RAW_TOKEN, 'NewPass123!')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a token that does not exist', async () => {
    const { service } = makeService({ resetTokenRow: null });
    await expect(service.resetPassword('unknown-token', 'NewPass123!')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('performs all mutations in a single transaction', async () => {
    const { service, prisma } = makeService({ resetTokenRow: makeValidRecord() });
    await service.resetPassword(RAW_TOKEN, 'NewPass123!');
    // $transaction is called once with an array of 3 operations
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const txOps = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    expect(Array.isArray(txOps)).toBe(true);
    expect(txOps).toHaveLength(3);
  });
});
