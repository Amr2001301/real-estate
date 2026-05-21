import { expect, type Page } from '@playwright/test';

// Credentials come from env; defaults match the dev seed (apps/api/prisma/seed.ts).
// Override outside dev — never commit real credentials.
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!';

export const SALES_EMAIL = process.env.E2E_SALES_EMAIL ?? 'sales@example.com';
export const SALES_PASSWORD = process.env.E2E_SALES_PASSWORD ?? 'SalesPass123!';

export const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? 'manager@example.com';
export const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD ?? 'ManagerPass123!';

/**
 * Log in through the real login form (email + password) and wait for the
 * dashboard to load. Throws a clear error if the form isn't found (web server /
 * API not running) or the redirect never happens (bad credentials / unseeded).
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');

  const emailField = page.locator('input[name="email"]');
  const passwordField = page.locator('input[name="password"]');

  try {
    await expect(emailField).toBeVisible({ timeout: 10_000 });
  } catch {
    throw new Error(
      'Login form not found at /login. Is the web-admin server running on ' +
        'E2E_BASE_URL and reachable? (input[name="email"] was never visible.)',
    );
  }

  await emailField.fill(email);
  await passwordField.fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  // The login server action sets the auth cookie then redirects to /dashboard
  // (or the ?from= path). If credentials are wrong we stay on /login.
  await page
    .waitForURL((url) => url.pathname.startsWith('/dashboard'), { timeout: 15_000 })
    .catch(() => {
      throw new Error(
        `Login did not redirect to /dashboard for ${email}. Check the matching ` +
          'E2E_*_EMAIL / E2E_*_PASSWORD and that the API is seeded with this user.',
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
