import { expect, type Page } from '@playwright/test';

/**
 * Credentials come from env so prod/staging never need a code edit. The
 * defaults are LOCAL/E2E ONLY (the same documented in
 * `apps/api/prisma/SEED_USERS.md` row 9). Override outside dev.
 */
export const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL ?? 'customer@example.com';
export const CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD ?? 'CustomerPass1!';

/**
 * Drive the customer email/password login form on `/login` and assert the
 * post-login redirect away from `/login`. Throws a clear error if the form
 * is missing (API or web-public server not running) or the redirect never
 * happens (bad creds / unseeded DB), mirroring the admin `loginAsAdmin`
 * helper's failure shape.
 */
export async function loginAsCustomer(
  page: Page,
  email: string = CUSTOMER_EMAIL,
  password: string = CUSTOMER_PASSWORD,
): Promise<void> {
  await page.goto('/login');

  // The form uses two `<Input>` components: the email field has
  // type="email" autoComplete="email"; the password field has
  // type="password" autoComplete="current-password". Selecting on
  // autocomplete keeps us stable against placeholder copy changes.
  const emailField = page.locator('input[autocomplete="email"]');
  const passwordField = page.locator('input[autocomplete="current-password"]');

  try {
    await expect(emailField).toBeVisible({ timeout: 10_000 });
  } catch {
    throw new Error(
      'Customer login form not found at /login. Is the web-public server running on ' +
        'E2E_BASE_URL and the API reachable?',
    );
  }

  await emailField.fill(email);
  await passwordField.fill(password);

  await page.getByRole('button', { name: 'دخول إلى الحساب' }).click();

  // Login resolves to either `from=<deep-link>` (preserved by middleware)
  // or the bare `/account` landing. Either way the URL must leave `/login`.
  await page
    .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
    .catch(() => {
      throw new Error(
        `Customer login did not redirect away from /login for ${email}. ` +
          'Check matching E2E_CUSTOMER_EMAIL/E2E_CUSTOMER_PASSWORD and that the ' +
          'API is seeded with this user (run `prisma:seed:e2e`).',
      );
    });
}
