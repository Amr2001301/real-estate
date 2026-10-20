import { expect, type APIRequestContext } from '@playwright/test';

export const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';
export const SLUG = process.env.E2E_COMPANY_SLUG ?? 'default';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!';

/**
 * The admin's API headers, for specs that set data up through the API. The
 * staff login allows 5 tries a minute per address, and several specs log
 * in: a 429 is waited out (up to a minute) rather than failing the spec.
 */
export async function adminApiHeaders(request: APIRequestContext) {
  for (let attempt = 0; attempt < 7; attempt++) {
    const login = await request.post(`${API_BASE}/v1/auth/login-staff`, {
      data: { slug: SLUG, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (login.status() === 429) {
      await new Promise((r) => setTimeout(r, 10_000));
      continue;
    }
    expect(login.ok()).toBeTruthy();
    const token = (await login.json()).tokens.accessToken as string;
    return { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': SLUG };
  }
  throw new Error('staff login still throttled after a minute');
}
