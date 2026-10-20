import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * The audit log: four summary cards, then the events grouped by day, each
 * with its kind icon, its name, its area and who did it — no raw HTTP
 * method ("POST", "PATCH") on the page.
 */
test('the audit log groups events by day and shows them by name', async ({ page }) => {
  await gotoReady(page, '/dashboard/audit-logs');
  for (const id of ['audit-total', 'audit-last', 'audit-kinds', 'audit-sensitive']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId('audit-days').locator('section').first()).toBeVisible();
  await expect(page.getByTestId('audit-row').first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/\b(POST|PATCH|PUT|DELETE)\b/);

  // A row opens its event.
  await page.getByTestId('audit-row').first().locator('a').click();
  await expect(page).toHaveURL(/\/dashboard\/audit-logs\/[\w-]+$/);
});
