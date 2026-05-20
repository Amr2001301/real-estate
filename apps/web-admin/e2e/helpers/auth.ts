import { expect, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!';

/**
 * Log in through the real login form (email + password) and wait for the
 * dashboard to load. Throws a clear error if the form isn't found — which
 * almost always means the web server or API isn't running.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
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

  await emailField.fill(ADMIN_EMAIL);
  await passwordField.fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  // The login server action sets the auth cookie then redirects to /dashboard
  // (or the ?from= path). If credentials are wrong we stay on /login with an
  // error — surface that as a clear failure.
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard'), {
    timeout: 15_000,
  }).catch(() => {
    throw new Error(
      'Login did not redirect to /dashboard. Check E2E_ADMIN_EMAIL / ' +
        'E2E_ADMIN_PASSWORD and that the API is seeded with the bootstrap admin.',
    );
  });
}
