import { expect, type Page } from '@playwright/test';

// Credentials come from env; defaults match the dev seed (apps/api/prisma/seed.ts).
// Override outside dev — never commit real credentials.
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!';

export const SALES_EMAIL = process.env.E2E_SALES_EMAIL ?? 'sales@example.com';
export const SALES_PASSWORD = process.env.E2E_SALES_PASSWORD ?? 'SalesPass123!';

export const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? 'manager@example.com';
export const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD ?? 'ManagerPass123!';

// Company slug for tenant-aware login. Defaults to the dev-seed default company slug.
export const COMPANY_SLUG = process.env.E2E_COMPANY_SLUG ?? 'default';

/**
 * Log in through the staff login form (company slug + email + password) and
 * wait for the dashboard to load.
 *
 * Phase I: the login form now has three fields — slug, email, password. The
 * backend endpoint is POST /auth/login-staff (tenant-aware). The legacy
 * POST /auth/login endpoint is NOT used by this helper.
 */
export async function login(page: Page, email: string, password: string, slug = COMPANY_SLUG): Promise<void> {
  await page.goto('/login');

  const slugField = page.locator('input[name="slug"]');
  const emailField = page.locator('input[name="email"]');
  const passwordField = page.locator('input[name="password"]');

  try {
    await expect(slugField).toBeVisible({ timeout: 10_000 });
  } catch {
    throw new Error(
      'Login form not found at /login. Is the web-admin server running on ' +
        'E2E_BASE_URL and reachable? (input[name="slug"] was never visible.)',
    );
  }

  await slugField.fill(slug);
  await emailField.fill(email);
  await passwordField.fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  await page
    .waitForURL((url) => url.pathname.startsWith('/dashboard'), { timeout: 15_000 })
    .catch(() => {
      throw new Error(
        `Login did not redirect to /dashboard for ${email} (slug: ${slug}). ` +
          'Check E2E_*_EMAIL / E2E_*_PASSWORD / E2E_COMPANY_SLUG and that the ' +
          'API is seeded with this user.',
      );
    });
}

export function loginAsAdmin(page: Page): Promise<void> {
  return login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

export function loginAsSales(page: Page): Promise<void> {
  return login(page, SALES_EMAIL, SALES_PASSWORD);
}

export function loginAsManager(page: Page): Promise<void> {
  return login(page, MANAGER_EMAIL, MANAGER_PASSWORD);
}
