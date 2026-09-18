/**
 * OTP Namespace Isolation — Phase C acceptance tests.
 *
 * Verifies that legacy OTP (companyId=null) and V2 tenant OTP (companyId=<uuid>)
 * are strictly partitioned. Each namespace can only create and consume its own rows.
 *
 * Tests A–H per Phase C acceptance specification.
 */

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

jest.mock('argon2', () => ({
  verify: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('$hashed'),
}));

const COMPANY_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const COMPANY_B = 'bbbbbbbb-0000-0000-0000-000000000001';

// Pre-computed SHA-256 of '123456' so tests can set codeHash directly.
import { createHash } from 'node:crypto';
function hash6(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

const LEGACY_CODE = '111111';
const V2_CODE_A = '222222';
const V2_CODE_B = '333333';

function makeOtpRow(
  code: string,
  companyId: string | null,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: `otp-${code}`,
    phone: '+966500000001',
    codeHash: hash6(code),
    consumed: false,
    attempts: 0,
    expiresAt: new Date(Date.now() + 600_000),
    companyId,
    ...overrides,
  };
}

function makeService() {
  const created: Array<Record<string, unknown>> = [];
  const otpStore: Array<ReturnType<typeof makeOtpRow>> = [];

  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'u-1',
        role: 'CLIENT',
        companyId: COMPANY_A,
        phone: '+966500000001',
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'u-1', role: 'CLIENT', fullName: 'User', email: null,
        phone: '+966500000001', locale: 'ar', active: true, emailVerifiedAt: null, companyId: COMPANY_A,
      }),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => ({
        id: 'u-new', role: 'CLIENT', ...args.data,
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    otpCode: {
      findFirst: jest.fn().mockImplementation(
        (args: { where: Record<string, unknown> }) => {
          // Find matching row from the store based on the where predicate.
          return Promise.resolve(
            otpStore.find((row) => {
              for (const [k, v] of Object.entries(args.where)) {
                if (k === 'createdAt' || k === 'expiresAt') continue;
                if ((row as Record<string, unknown>)[k] !== v) return false;
              }
              return true;
            }) ?? null,
          );
        },
      ),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
        const row = { id: `otp-${Date.now()}`, ...args.data } as ReturnType<typeof makeOtpRow>;
        otpStore.push(row);
        created.push(args.data);
        return Promise.resolve(row);
      }),
      update: jest.fn().mockImplementation(
        (args: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = otpStore.find((r) => r.id === args.where.id);
          if (row) Object.assign(row, args.data);
          return Promise.resolve(row);
        },
      ),
    },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
    emailVerificationToken: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
  };

  const jwt = { signAsync: jest.fn().mockResolvedValue('tok') };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('s'),
    get: jest.fn().mockImplementation((k: string) => (k.includes('REFRESH') ? '30d' : '15m')),
  };
  const sms = { sendOtp: jest.fn().mockResolvedValue(undefined) };
  const email = { sendPasswordReset: jest.fn() };

  const caps = { hasCapability: jest.fn().mockResolvedValue(true) };
  const service = new AuthService(
    prisma as never, jwt as never, config as never, sms as never, email as never, caps as never,
  );

  return { service, prisma, sms, created, otpStore };
}

// ── A: Legacy request creates companyId=null ─────────────────────────────────

test('A — legacy requestOtp creates a row with companyId=null', async () => {
  const { service, created } = makeService();
  await service.requestOtp('+966500000001');
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ phone: '+966500000001', companyId: null });
});

// ── B: Legacy verify matches companyId=null only ─────────────────────────────

test('B — legacy verifyOtp queries with companyId=null', async () => {
  const { service, prisma, otpStore } = makeService();
  // Seed a legacy OTP row directly into the store.
  otpStore.push(makeOtpRow(LEGACY_CODE, null));

  await service.verifyOtp('+966500000001', LEGACY_CODE);

  // Confirm the findFirst call included companyId: null.
  const call = (prisma.otpCode.findFirst as jest.Mock).mock.calls[0][0] as { where: Record<string, unknown> };
  expect(call.where).toMatchObject({ companyId: null });
});

// ── C: V2 request for Company A creates companyId=A ──────────────────────────

test('C — V2 requestOtpV2 creates a row with companyId=COMPANY_A', async () => {
  const { service, created } = makeService();
  await service.requestOtpV2(COMPANY_A, 'SA', '+966500000001');
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ phone: '+966500000001', companyId: COMPANY_A });
});

// ── D: V2 verify A succeeds for A's OTP ──────────────────────────────────────

test("D — V2 verifyOtpV2 succeeds when matching Company A's OTP", async () => {
  const { service, otpStore } = makeService();
  otpStore.push(makeOtpRow(V2_CODE_A, COMPANY_A));
  const result = await service.verifyOtpV2(COMPANY_A, 'SA', '+966500000001', V2_CODE_A);
  expect(result.tokens.accessToken).toBe('tok');
});

// ── E: V2 verify B cannot consume A's OTP ────────────────────────────────────

test("E — V2 verifyOtpV2 for Company B cannot consume Company A's OTP", async () => {
  const { service, prisma, otpStore } = makeService();
  // Store A's OTP; B query should NOT find it.
  otpStore.push(makeOtpRow(V2_CODE_A, COMPANY_A));

  // Override findFirst to strictly simulate companyId-scoped query.
  (prisma.otpCode.findFirst as jest.Mock).mockResolvedValue(null);

  await expect(
    service.verifyOtpV2(COMPANY_B, 'SA', '+966500000001', V2_CODE_A),
  ).rejects.toBeInstanceOf(BadRequestException);

  const call = (prisma.otpCode.findFirst as jest.Mock).mock.calls[0][0] as { where: Record<string, unknown> };
  expect(call.where).toMatchObject({ companyId: COMPANY_B });
  expect(call.where.companyId).not.toBeNull();
});

// ── F: Legacy verify cannot consume A's V2 OTP ───────────────────────────────

test("F — legacy verifyOtp cannot consume a V2 OTP (companyId=A)", async () => {
  const { service, otpStore } = makeService();
  // Seed ONLY a V2 row — no legacy (companyId=null) row exists.
  otpStore.push(makeOtpRow(V2_CODE_A, COMPANY_A));

  // Legacy verify looks for companyId=null → finds nothing.
  await expect(service.verifyOtp('+966500000001', V2_CODE_A)).rejects.toBeInstanceOf(
    BadRequestException,
  );
});

// ── G: V2 verify A cannot consume a legacy companyId=null OTP ────────────────

test('G — V2 verifyOtpV2 cannot consume a legacy companyId=null OTP', async () => {
  const { service, otpStore } = makeService();
  otpStore.push(makeOtpRow(LEGACY_CODE, null));

  // V2 verify looks for companyId=COMPANY_A → finds nothing.
  await expect(
    service.verifyOtpV2(COMPANY_A, 'SA', '+966500000001', LEGACY_CODE),
  ).rejects.toBeInstanceOf(BadRequestException);
});

// ── H: Consuming one namespace OTP does not consume the other ─────────────────

test('H — consuming legacy OTP does not affect V2 OTP and vice versa', async () => {
  const { service, otpStore } = makeService();

  // Seed one legacy row and one V2 row for the same phone.
  const legacyRow = makeOtpRow(LEGACY_CODE, null);
  const v2Row = makeOtpRow(V2_CODE_A, COMPANY_A);
  otpStore.push(legacyRow, v2Row);

  // Consume the legacy OTP.
  await service.verifyOtp('+966500000001', LEGACY_CODE);
  expect(legacyRow.consumed).toBe(true);

  // The V2 row must remain unconsumed.
  expect(v2Row.consumed).toBe(false);

  // Independently verify V2 OTP still works.
  const result = await service.verifyOtpV2(COMPANY_A, 'SA', '+966500000001', V2_CODE_A);
  expect(result.tokens.accessToken).toBe('tok');
  expect(v2Row.consumed).toBe(true);
  expect(legacyRow.consumed).toBe(true); // still consumed, not changed back
});
