import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * Log in as a seeded user via the real auth endpoints and return the
 * access token. We deliberately exercise the full chain (JWT signing,
 * refresh-token persistence, password verification) instead of minting
 * tokens directly.
 *
 * Two endpoints exist by design:
 *   - `POST /v1/auth/login`           — staff + brokers (ADMIN, SALES,
 *                                       SALES_MANAGER, MAINTENANCE_SUPERVISOR,
 *                                       BROKER). Rejects CLIENT/CUSTOMER.
 *   - `POST /v1/auth/customer/login`  — CLIENT/CUSTOMER. Rejects staff.
 *
 * The audience parameter picks the right one. Defaults to staff so
 * existing callers don't change.
 *
 * Throws loudly on a non-2xx response so the offending status appears in
 * the failure output instead of a confusing "undefined token" further
 * down.
 */
export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
  audience: 'staff' | 'customer' = 'staff',
): Promise<string> {
  const path = audience === 'customer' ? '/v1/auth/customer/login' : '/v1/auth/login';
  const res = await request(app.getHttpServer()).post(path).send({ email, password });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Login (${audience}) failed for ${email}: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }
  // Response shape (per AuthService): `{ user, tokens: { accessToken, refreshToken, expiresIn } }`.
  // We also accept a flat `{ accessToken }` for robustness in case the
  // controller's contract evolves.
  const token: unknown = res.body?.tokens?.accessToken ?? res.body?.accessToken;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(
      `Login (${audience}) for ${email} returned no accessToken: ${JSON.stringify(res.body)}`,
    );
  }
  return token;
}

/** Bearer-auth helper for supertest chains. */
export function bearer(token: string): string {
  return `Bearer ${token}`;
}
