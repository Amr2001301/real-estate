import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * The financial report: what came in and the collection rate up top with the
 * six months of collected against due, the three key figures, and the
 * overdue section — one calm line when nothing is late. No raw status code
 * ("PENDING") reaches the page.
 */
test('the financial report leads with collections, the rate and the months', async ({ page }) => {
  await gotoReady(page, '/dashboard/reports/financial');
  await expect(page.getByTestId('fin-hero')).toBeVisible();
  await expect(page.getByTestId('fin-collected')).toHaveText(/\d/);
  await expect(page.getByTestId('fin-rate')).toHaveText(/^\d+%$/);
  for (const id of ['fin-kpi-contracts', 'fin-kpi-outstanding', 'fin-kpi-overdue', 'fin-distribution', 'fin-upcoming']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }

  // Six months, or a note when there is nothing to draw.
  const months = page.getByTestId('fin-cashflow-month');
  if (await page.getByTestId('fin-cashflow').count()) await expect(months).toHaveCount(6);

  // Overdue: either the all-clear line or the overdue panel, never both.
  const clear = await page.getByTestId('fin-all-clear').count();
  const overdueTitle = await page.getByRole('heading', { name: 'الأقساط المتأخرة' }).count();
  expect(clear + overdueTitle).toBe(1);

  await expect(page.locator('main')).not.toContainText('PENDING');
});
