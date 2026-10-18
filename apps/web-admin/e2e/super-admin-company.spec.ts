import { test, expect } from '@playwright/test';

/**
 * The platform owner opens a company. The page read `_count.users`, which the
 * API never sends (it sends `userCount`), so every company page crashed into
 * the error boundary ("Cannot read properties of undefined (reading 'users')")
 * and no plan, module or capability could be changed from the dashboard.
 *
 * Super-admin login is its own endpoint, outside the staff login throttle
 * global-setup spends.
 */
const EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? 'platform@example.com';
const PASSWORD = process.env.E2E_SUPER_ADMIN_PASSWORD ?? 'PlatformPass1!!';

test('the super admin opens a company page and sees its users', async ({ page }) => {
  await page.goto('/super-admin/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20_000 }),
    page.locator('form button[type=submit]').click(),
  ]);

  await page.goto('/dashboard/super-admin/companies', { waitUntil: 'networkidle' });
  const companyLink = page
    .locator('a[href*="/dashboard/super-admin/companies/"]')
    .filter({ hasNotText: /جديد|new/i })
    .first();
  await companyLink.click();
  await page.waitForURL(/\/dashboard\/super-admin\/companies\/[0-9a-f-]{36}$/);
  await page.waitForLoadState('networkidle');

  // The users card is titled with the company's user count (the old page
  // rendered the error boundary instead, once its data had loaded).
  const main = page.locator('main');
  await expect(main).toContainText(/\(\d+\)/);
  await expect(main).not.toContainText('حدث خطأ');
});
