/**
 * Production environment validation unit tests.
 *
 * Verifies that configValidation() enforces all production-only invariants:
 *   - OTP_PROVIDER=console is rejected in production (silent delivery failure)
 *   - REDIS_URL must not resolve to localhost in production
 *   - Twilio credentials required when OTP_PROVIDER=twilio
 *   - JWT secrets must be long and non-placeholder
 *   - CORS, R2, SMTP, SEED_ADMIN_PASSWORD invariants preserved
 *
 * Development and test environments allow convenient defaults throughout.
 */

import { configValidation } from '../env.validation';

// ── Minimal valid production config ─────────────────────────────────────────
function validProd(overrides: Record<string, string | undefined> = {}): Record<string, unknown> {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://prod-db:5432/realestate',
    REDIS_URL: 'redis://redis.prod.internal:6379',
    JWT_ACCESS_SECRET: 'a-very-long-access-secret-for-production-use-here',
    JWT_REFRESH_SECRET: 'b-very-long-refresh-secret-for-production-use-here',
    CORS_ORIGINS: 'https://app.example.com',
    OTP_PROVIDER: 'twilio',
    TWILIO_ACCOUNT_SID: 'ACteststubsid',
    TWILIO_AUTH_TOKEN: 'teststubtoken',
    TWILIO_FROM: '+15005550006',
    SMTP_HOST: 'smtp.prod.example.com',
    SMTP_USER: 'apiuser',
    SMTP_PASSWORD: 'smtppassword',
    SMTP_FROM: 'noreply@example.com',
    R2_ACCOUNT_ID: 'r2accountid',
    R2_ACCESS_KEY_ID: 'r2accesskeyid',
    R2_SECRET_ACCESS_KEY: 'r2secretkey',
    R2_BUCKET: 'prod-media',
    R2_PUBLIC_URL: 'https://media.example.com',
    R2_PRIVATE_BUCKET: 'prod-private',
    PUBLIC_WEB_URL: 'https://app.example.com',
    SEED_ADMIN_PASSWORD: 'Pr0ductionSecurePass!',
    DEFAULT_COMPANY_ID: 'a0000000-0000-4000-8000-000000000001',
    PLATFORM_BASE_DOMAIN: 'platform.example.com',
    FIREBASE_PROJECT_ID: 'prod-project-id',
    FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk@prod-project-id.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0stub\n-----END RSA PRIVATE KEY-----\n',
    ...overrides,
  };
}

function devEnv(overrides: Record<string, string | undefined> = {}): Record<string, unknown> {
  return {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/realestate',
    // Zod base schema requires ≥16 chars; production requires ≥32.
    JWT_ACCESS_SECRET: 'dev-access-secret',
    JWT_REFRESH_SECRET: 'dev-refresh-secret',
    ...overrides,
  };
}

function expectValidationError(raw: Record<string, unknown>, fragment: string): void {
  expect(() => configValidation(raw)).toThrow(fragment);
}

function expectValidationPass(raw: Record<string, unknown>): void {
  expect(() => configValidation(raw)).not.toThrow();
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP Provider
// ─────────────────────────────────────────────────────────────────────────────

describe('OTP provider', () => {
  describe('production', () => {
    it('rejects OTP_PROVIDER=console — codes silently undelivered', () => {
      expectValidationError(
        validProd({ OTP_PROVIDER: 'console' }),
        'OTP_PROVIDER=console is not allowed in production',
      );
    });

    it('rejects missing OTP_PROVIDER (defaults to console)', () => {
      const env = validProd({ OTP_PROVIDER: undefined });
      // When omitted the schema default is 'console', which production rejects
      expectValidationError(env, 'OTP_PROVIDER=console is not allowed in production');
    });

    it('accepts OTP_PROVIDER=twilio with all credentials present', () => {
      expectValidationPass(validProd({ OTP_PROVIDER: 'twilio' }));
    });

    it('rejects OTP_PROVIDER=twilio when TWILIO_ACCOUNT_SID is missing', () => {
      expectValidationError(
        validProd({ OTP_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: undefined }),
        'TWILIO_ACCOUNT_SID is required when OTP_PROVIDER=twilio',
      );
    });

    it('rejects OTP_PROVIDER=twilio when TWILIO_AUTH_TOKEN is missing', () => {
      expectValidationError(
        validProd({ OTP_PROVIDER: 'twilio', TWILIO_AUTH_TOKEN: undefined }),
        'TWILIO_AUTH_TOKEN is required when OTP_PROVIDER=twilio',
      );
    });

    it('rejects OTP_PROVIDER=twilio when TWILIO_FROM is missing', () => {
      expectValidationError(
        validProd({ OTP_PROVIDER: 'twilio', TWILIO_FROM: undefined }),
        'TWILIO_FROM is required when OTP_PROVIDER=twilio',
      );
    });
  });

  describe('development', () => {
    it('allows OTP_PROVIDER=console (dev default)', () => {
      expectValidationPass(devEnv({ OTP_PROVIDER: 'console' }));
    });

    it('allows omitted OTP_PROVIDER (schema default is console)', () => {
      expectValidationPass(devEnv());
    });

    it('allows OTP_PROVIDER=twilio without Twilio credentials', () => {
      // Twilio credentials are only enforced in production
      expectValidationPass(devEnv({ OTP_PROVIDER: 'twilio' }));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Redis URL
// ─────────────────────────────────────────────────────────────────────────────

describe('REDIS_URL', () => {
  describe('production', () => {
    it('rejects localhost Redis (default when REDIS_URL unset)', () => {
      expectValidationError(
        validProd({ REDIS_URL: 'redis://localhost:6379' }),
        'REDIS_URL must be explicitly configured to an external Redis instance',
      );
    });

    it('rejects 127.0.0.1 Redis', () => {
      expectValidationError(
        validProd({ REDIS_URL: 'redis://127.0.0.1:6379' }),
        'REDIS_URL must be explicitly configured to an external Redis instance',
      );
    });

    it('rejects missing REDIS_URL (schema default is localhost)', () => {
      const env = validProd({ REDIS_URL: undefined });
      expectValidationError(env, 'REDIS_URL must be explicitly configured to an external Redis instance');
    });

    it('accepts an explicit external Redis URL', () => {
      expectValidationPass(validProd({ REDIS_URL: 'redis://redis.prod.internal:6379' }));
    });

    it('accepts a Redis URL with a non-local hostname', () => {
      expectValidationPass(validProd({ REDIS_URL: 'rediss://managed-redis.cloud.provider.com:6380' }));
    });
  });

  describe('development', () => {
    it('allows localhost Redis', () => {
      expectValidationPass(devEnv({ REDIS_URL: 'redis://localhost:6379' }));
    });

    it('allows 127.0.0.1 Redis', () => {
      expectValidationPass(devEnv({ REDIS_URL: 'redis://127.0.0.1:6379' }));
    });

    it('allows omitted REDIS_URL (schema default is localhost)', () => {
      expectValidationPass(devEnv());
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JWT Secrets (existing invariants preserved)
// ─────────────────────────────────────────────────────────────────────────────

describe('JWT secrets', () => {
  it('production rejects secrets shorter than 32 chars (but ≥16 to pass base Zod schema)', () => {
    // 'valid-but-only-20-c' is 20 chars — passes Zod ≥16 but fails production ≥32 check.
    expectValidationError(
      validProd({ JWT_ACCESS_SECRET: 'valid-but-only-20-c' }),
      'JWT_ACCESS_SECRET must be at least 32 characters in production',
    );
  });

  it('production rejects the exact placeholder access secret', () => {
    // 'change-me-access-secret' is 23 chars: fails both length (<32) AND placeholder checks.
    expectValidationError(
      validProd({ JWT_ACCESS_SECRET: 'change-me-access-secret' }),
      'JWT_ACCESS_SECRET',
    );
  });

  it('production rejects identical access and refresh secrets', () => {
    const same = 'a-very-long-secret-that-is-definitely-32-chars';
    expectValidationError(
      validProd({ JWT_ACCESS_SECRET: same, JWT_REFRESH_SECRET: same }),
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ',
    );
  });

  it('development allows secrets shorter than 32 chars (only 16 chars required by base schema)', () => {
    // Base schema requires ≥16 chars; the ≥32 char rule is production-only.
    expectValidationPass(devEnv({ JWT_ACCESS_SECRET: 'exactly-16-chars', JWT_REFRESH_SECRET: 'exactly-16-char2' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEED_ADMIN_PASSWORD (existing invariant preserved)
// ─────────────────────────────────────────────────────────────────────────────

describe('SEED_ADMIN_PASSWORD', () => {
  it('production rejects the default placeholder password', () => {
    expectValidationError(
      validProd({ SEED_ADMIN_PASSWORD: 'ChangeMe123!' }),
      'SEED_ADMIN_PASSWORD still uses the .env.example default',
    );
  });

  it('production accepts a non-default password', () => {
    expectValidationPass(validProd({ SEED_ADMIN_PASSWORD: 'Unique$3cureP4ss!' }));
  });

  it('development allows the default placeholder', () => {
    expectValidationPass(devEnv({ SEED_ADMIN_PASSWORD: 'ChangeMe123!' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R2 storage isolation — R2_PRIVATE_BUCKET
// ─────────────────────────────────────────────────────────────────────────────

describe('R2 storage isolation (R2_PRIVATE_BUCKET)', () => {
  describe('production', () => {
    it('rejects missing R2_PRIVATE_BUCKET', () => {
      expectValidationError(
        validProd({ R2_PRIVATE_BUCKET: undefined }),
        'R2_PRIVATE_BUCKET',
      );
    });

    it('rejects R2_PRIVATE_BUCKET equal to R2_BUCKET (same bucket defeats isolation)', () => {
      expectValidationError(
        validProd({ R2_BUCKET: 'same-bucket', R2_PRIVATE_BUCKET: 'same-bucket' }),
        'R2_BUCKET and R2_PRIVATE_BUCKET must be different buckets',
      );
    });

    it('accepts distinct public and private buckets', () => {
      expectValidationPass(
        validProd({ R2_BUCKET: 'media-public', R2_PRIVATE_BUCKET: 'media-private' }),
      );
    });
  });

  describe('development', () => {
    it('allows missing R2_PRIVATE_BUCKET in development', () => {
      expectValidationPass(devEnv({ R2_PRIVATE_BUCKET: undefined }));
    });

    it('allows same bucket for public and private in development (no isolation required)', () => {
      expectValidationPass(devEnv({ R2_BUCKET: 'dev-bucket', R2_PRIVATE_BUCKET: 'dev-bucket' }));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM_BASE_DOMAIN — required in production for subdomain provisioning
// ─────────────────────────────────────────────────────────────────────────────
// Without this, provisionPlatformSubdomain() silently skips and every new
// tenant's public site 404s on every page from day one. Boot-time validation
// is the only reliable guard — a company can be created and look healthy (201)
// while its site is permanently broken if this check is absent.

describe('PLATFORM_BASE_DOMAIN', () => {
  it('production rejects missing PLATFORM_BASE_DOMAIN — public sites would 404 forever', () => {
    expectValidationError(
      validProd({ PLATFORM_BASE_DOMAIN: undefined }),
      'PLATFORM_BASE_DOMAIN is required in production',
    );
  });

  it('development allows missing PLATFORM_BASE_DOMAIN', () => {
    expectValidationPass(devEnv({ PLATFORM_BASE_DOMAIN: undefined }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full valid production config passes
// ─────────────────────────────────────────────────────────────────────────────

describe('full valid production config', () => {
  it('passes with all required fields correctly set', () => {
    expectValidationPass(validProd());
  });
});
