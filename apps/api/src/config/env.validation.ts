import { z } from 'zod';

const PLACEHOLDER_JWT_SECRETS = new Set([
  'change-me-access-secret',
  'change-me-refresh-secret',
]);

const PLACEHOLDER_SEED_PASSWORD = 'ChangeMe123!';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default(''),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  OTP_PROVIDER: z.enum(['console', 'twilio']).default('console'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('ChangeMe123!'),

  // ─── Observability (all optional) ───────────────────────────────────────
  // When SENTRY_DSN is unset the SDK is never required at runtime.
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  // `LOG_FORMAT` controls the API logger: `json` for prod log aggregators,
  // `pretty` for local dev. Unset → JSON in production, pretty elsewhere.
  LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

/**
 * Additional checks that only fire in production. Keeping these out of the
 * base Zod schema means dev/test still boots with placeholder values, so
 * `pnpm dev` and CI remain frictionless.
 */
function assertProductionRequirements(env: AppEnv): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const errs: string[] = [];

  // JWT secrets: longer + must not be the placeholders shipped in .env.example.
  if (env.JWT_ACCESS_SECRET.length < 32) {
    errs.push('JWT_ACCESS_SECRET must be at least 32 characters in production');
  }
  if (env.JWT_REFRESH_SECRET.length < 32) {
    errs.push('JWT_REFRESH_SECRET must be at least 32 characters in production');
  }
  if (PLACEHOLDER_JWT_SECRETS.has(env.JWT_ACCESS_SECRET)) {
    errs.push('JWT_ACCESS_SECRET still uses the .env.example placeholder');
  }
  if (PLACEHOLDER_JWT_SECRETS.has(env.JWT_REFRESH_SECRET)) {
    errs.push('JWT_REFRESH_SECRET still uses the .env.example placeholder');
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    errs.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  // CORS: an empty origins list in production almost always means a misconfig.
  if (!env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean).length) {
    errs.push('CORS_ORIGINS must list at least one origin in production');
  }

  // Cloudflare R2 — production file storage for media/receipts/contracts.
  const r2Fields: Array<[keyof AppEnv, string]> = [
    ['R2_ACCOUNT_ID', 'R2_ACCOUNT_ID'],
    ['R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID'],
    ['R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY'],
    ['R2_BUCKET', 'R2_BUCKET'],
    ['R2_PUBLIC_URL', 'R2_PUBLIC_URL'],
  ];
  for (const [key, label] of r2Fields) {
    if (!env[key]) errs.push(`${label} is required in production (file uploads will fail)`);
  }

  // SMTP — required so notification emails actually leave the box.
  const smtpFields: Array<[keyof AppEnv, string]> = [
    ['SMTP_HOST', 'SMTP_HOST'],
    ['SMTP_USER', 'SMTP_USER'],
    ['SMTP_PASSWORD', 'SMTP_PASSWORD'],
    ['SMTP_FROM', 'SMTP_FROM'],
  ];
  for (const [key, label] of smtpFields) {
    if (!env[key]) errs.push(`${label} is required in production`);
  }

  // Twilio — only required when the SMS path is actually enabled.
  if (env.OTP_PROVIDER === 'twilio') {
    if (!env.TWILIO_ACCOUNT_SID) errs.push('TWILIO_ACCOUNT_SID is required when OTP_PROVIDER=twilio');
    if (!env.TWILIO_AUTH_TOKEN) errs.push('TWILIO_AUTH_TOKEN is required when OTP_PROVIDER=twilio');
    if (!env.TWILIO_FROM) errs.push('TWILIO_FROM is required when OTP_PROVIDER=twilio');
  }

  // Firebase is intentionally NOT required — FCM is not yet wired in code.
  // See apps/api/.env.example for the documented reason.

  // Don't ship to production with the default admin password.
  if (env.SEED_ADMIN_PASSWORD === PLACEHOLDER_SEED_PASSWORD) {
    errs.push('SEED_ADMIN_PASSWORD still uses the .env.example default — change it');
  }

  return errs;
}

export function configValidation(raw: Record<string, unknown>): AppEnv {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  const prodIssues = assertProductionRequirements(parsed.data);
  if (prodIssues.length) {
    const list = prodIssues.map((m) => `  - ${m}`).join('\n');
    throw new Error(`Invalid environment variables (production requirements):\n${list}`);
  }

  return parsed.data;
}
