import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * Permissions: the catalogue is compact tiles named in Arabic (the code is
 * only a tooltip), and a user's permission is granted and revoked with a
 * switch on its tile.
 */
test('the catalogue names permissions without their codes', async ({ page }) => {
  await gotoReady(page, '/dashboard/permissions');
  await expect(page.getByText('إدارة المباني').first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText('buildings:manage');
  // Every permission has its Arabic name: no code ("reservations:delete") as a title.
  await expect(page.locator('main')).not.toContainText(/\b[a-z_-]+:[a-z_:-]+\b/);
});

test("a user's permission is switched on and off from its tile", async ({ page }) => {
  await gotoReady(page, '/dashboard/users');
  await page.getByTestId('users-table').locator('tr', { hasText: 'Ahmed Khaled' }).locator('a[href$="/permissions"]').click();
  await expect(page).toHaveURL(/\/permissions$/);
  await expect(page.getByTestId('user-permissions-hero')).toBeVisible();
  // No "back to permissions" button (the breadcrumb leads there).
  await expect(page.getByRole('link', { name: 'العودة للصلاحيات' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('buildings:manage');

  const tile = page.getByTestId('permission-toggle').filter({ hasText: 'إدارة المباني' });
  const before = await tile.getAttribute('aria-checked');
  await tile.click();
  await expect(tile).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
  await tile.click();
  await expect(tile).toHaveAttribute('aria-checked', before ?? 'false');
});
