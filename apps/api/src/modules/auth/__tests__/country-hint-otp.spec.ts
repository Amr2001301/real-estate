/**
 * Country-hint / phone-normalisation defect in OTP auth.
 *
 * Root cause: tenant-resolver.service.ts:54 returns `company.country ?? 'SA'`.
 * When a company has country = null (all test fixtures, most seed companies), the
 * fallback is 'SA', not 'EG'. The auth service passes that value directly to
 * canonicalPhone() as the country hint. Egyptian local numbers (01XXXXXXXXX)
 * are not valid Saudi numbers, so canonicalPhone('01...', 'SA') = null, which
 * causes requestOtpV2 / verifyOtpV2 to throw 400 "Invalid phone number".
 *
 * Concrete failure path:
 *   1. Importer creates customer with phone stored as '+201012345678' (E.164).
 *   2. Customer opens the app and enters '01012345678' (local format).
 *   3. Server calls requestOtpV2(companyId, 'SA', '01012345678').
 *   4. canonicalPhone('01012345678') = null  (no + prefix)
 *      canonicalPhone('01012345678', 'SA') = null  (invalid SA number)
 *   5. BadRequestException('Invalid phone number') — customer is locked out.
 *
 * The tests below are CURRENTLY RED. They assert correct behaviour.
 * Fixing the `?? 'SA'` fallback to `?? 'EG'` (and the schema default) makes
 * them green. Do not flip the assertions to silence the failure — that would
 * hide the bug.
 *
 * A companion case is also included showing that E.164 input (+20…) works
 * correctly even with the wrong hint, so the importer output is safe; the
 * breakage is specific to local-format entry.
 */

import { createHash } from 'node:crypto';
import { AuthService } from '../auth.service';

jest.mock('argon2', () => ({
  verify: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('$hashed'),
}));

const COMPANY_EG = 'cccccccc-0000-0000-0000-000000000001';

const EG_PHONE_E164 = '+201012345678';   // stored by importer
const EG_PHONE_LOCAL = '01012345678';    // entered by customer in the app

function hash6(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

function makeService() {
  const otpStore: Array<Record<string, unknown>> = [];
  const created: Array<Record<string, unknown>> = [];

  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'user-eg-1',
        role: 'CLIENT',
        companyId: COMPANY_EG,
        phone: EG_PHONE_E164,
        fullName: 'Customer',
        locale: 'ar',
        active: true,
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-eg-1',
        role: 'CLIENT',
        companyId: COMPANY_EG,
        phone: EG_PHONE_E164,
        fullName: 'Customer',
        locale: 'ar',
        active: true,
        email: null,
        emailVerifiedAt: null,
      }),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => ({
        id: 'user-eg-new',
        role: 'CLIENT',
        ...args.data,
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    otpCode: {
      findFirst: jest.fn().mockImplementation(
        (args: { where: Record<string, unknown> }) => {
          return Promise.resolve(
            otpStore.find((row) => {
              for (const [k, v] of Object.entries(args.where)) {
                if (k === 'createdAt' || k === 'expiresAt') continue;
                if (row[k] !== v) return false;
              }
              return true;
            }) ?? null,
          );
        },
      ),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
        const row = { id: `otp-${Date.now()}`, ...args.data };
        otpStore.push(row);
        created.push(args.data);
        return Promise.resolve(row);
      }),
      update: jest.fn().mockImplementation(
        (args: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = otpStore.find((r) => r.id === args.where.id);
          if (row) Object.assign(row, args.data);
          return Promise.resolve(row ?? {});
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

// ── Companion: E.164 format always works regardless of country hint ───────────
// This passes TODAY. It shows the importer output (+20...) is safe — the
// breakage is specific to customers entering the local format.

test('OTP request with E.164 format succeeds even when country hint is SA', async () => {
  const { service, created } = makeService();
  await service.requestOtpV2(COMPANY_EG, 'SA', EG_PHONE_E164);
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ phone: EG_PHONE_E164, companyId: COMPANY_EG });
});

// ── Multi-country fallback: wrong hint must not lock out an unambiguous number ─
// These two tests are RED until canonicalPhone gains its multi-country fallback
// (identity-normalize.ts). Once it does, an Egyptian number passed with the
// wrong 'SA' hint resolves via the EG fallback path rather than returning null.

test('OTP request with local Egyptian format resolves even with SA hint', async () => {
  // '01012345678' is unambiguous in the EG/SA/AE supported-country set.
  // canonicalPhone('01012345678', 'SA') should fall through to the EG fallback
  // and resolve '+201012345678' rather than throwing 400.
  const { service, created } = makeService();
  await service.requestOtpV2(COMPANY_EG, 'SA', EG_PHONE_LOCAL);
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ phone: EG_PHONE_E164, companyId: COMPANY_EG });
});

test('OTP request with local Egyptian format and correct EG hint succeeds', async () => {
  // This is the expected behaviour after the fix.
  // Currently PASSES (correct country hint works).
  const { service, created } = makeService();
  await service.requestOtpV2(COMPANY_EG, 'EG', EG_PHONE_LOCAL);
  expect(created).toHaveLength(1);
  // canonicalPhone('01012345678', 'EG') must resolve to E.164.
  expect(created[0]).toMatchObject({ phone: EG_PHONE_E164, companyId: COMPANY_EG });
});

test('OTP verify with local Egyptian format resolves even with SA hint', async () => {
  // Mirror of the request test. verifyOtpV2 also calls canonicalPhone; with the
  // multi-country fallback the local format resolves correctly to +20..., the
  // OTP is found, and tokens are issued.
  const { service, otpStore } = makeService();
  otpStore.push({
    id: 'otp-test',
    phone: EG_PHONE_E164,
    codeHash: hash6('777777'),
    consumed: false,
    attempts: 0,
    expiresAt: new Date(Date.now() + 600_000),
    companyId: COMPANY_EG,
  });

  const result = await service.verifyOtpV2(COMPANY_EG, 'SA', EG_PHONE_LOCAL, '777777');
  expect(result.tokens.accessToken).toBe('tok');
});

test('OTP verify with local Egyptian format and correct EG hint succeeds', async () => {
  // Expected behaviour after the fix.
  const { service, otpStore } = makeService();
  otpStore.push({
    id: 'otp-test',
    phone: EG_PHONE_E164,
    codeHash: hash6('777777'),
    consumed: false,
    attempts: 0,
    expiresAt: new Date(Date.now() + 600_000),
    companyId: COMPANY_EG,
  });

  const result = await service.verifyOtpV2(COMPANY_EG, 'EG', EG_PHONE_LOCAL, '777777');
  expect(result.tokens.accessToken).toBe('tok');
});
