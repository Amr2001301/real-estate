import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE, SALES_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * Notifications: sending and the templates are the admin's — the API
 * refuses anyone else, so nobody else is offered them. The templates are
 * listed by their subject (the code only a tooltip), and the manual send
 * form names its choices in Arabic, not "IN_APP" / "CUSTOMER".
 */
test.describe('admin', () => {
  test.use({ storageState: ADMIN_STORAGE });

  test('the inbox, the send and the templates', async ({ page }) => {
    await gotoReady(page, '/dashboard/notifications');
    await expect(page.getByTestId('notifications-admin-actions')).toBeVisible();

    await gotoReady(page, '/dashboard/notifications/templates');
    await expect(page.getByTestId('templates-list').locator('li').first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/\b[a-z]+_[a-z_]+\b/);

    await gotoReady(page, '/dashboard/notifications/broadcast');
    await expect(page.locator('main')).not.toContainText(/IN_APP|CUSTOMER|UUID|Firebase/);
  });
});

test.describe('sales', () => {
  test.use({ storageState: SALES_STORAGE });

  test('no send or templates offered, and their pages are closed', async ({ page }) => {
    await gotoReady(page, '/dashboard/notifications');
    await expect(page.getByTestId('notifications-admin-actions')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'قوالب الإشعارات' })).toHaveCount(0);

    await page.goto('/dashboard/notifications/templates');
    await expect(page.getByTestId('templates-list')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'قالب جديد' })).toHaveCount(0);
  });
});
