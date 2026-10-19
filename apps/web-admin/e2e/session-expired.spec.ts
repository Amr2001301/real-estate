import { test, expect, type BrowserContext } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * A session that can no longer be renewed sends the user to the login page.
 * The redirect to /login is thrown as an exception, and `safe()` and the
 * server actions caught it like an API error: pages showed "تعذّر تحميل"
 * boxes (or an English 404) and forms showed "NEXT_REDIRECT" instead. Once
 * let through, the dead cookies made /login bounce back to the dashboard.
 */
async function expireSession(context: BrowserContext) {
  const cookies = await context.cookies();
  await context.addCookies(
    cookies
      .filter((c) => c.name === 'access_token' || c.name === 'refresh_token')
      .map((c) => ({ ...c, value: `${c.value.slice(0, -6)}expired` })),
  );
}

test('a page opened with an unrenewable session goes to the login page', async ({
  page,
  context,
}) => {
  await expireSession(context);
  await page.goto('/dashboard/leads');
  await expect(page).toHaveURL(/\/login\?expired=1/);
  await expect(page.getByText('انتهت جلستك')).toBeVisible();
  // The dead cookies are gone, so the login page stays put (no redirect loop).
  expect((await context.cookies()).some((c) => c.name === 'access_token')).toBe(false);
});

test('a form submitted with an unrenewable session goes to the login page', async ({
  page,
  context,
}) => {
  await gotoReady(page, '/dashboard/leads/sources');
  await expireSession(context);
  const add = page.getByTestId('lead-source-add');
  await add.locator('input[name="ar"]').fill('جلسة منتهية');
  await add.locator('input[name="en"]').fill('Expired session');
  await add.getByRole('button', { name: 'إضافة مصدر' }).click();
  await expect(page).toHaveURL(/\/login\?expired=1/);
});
