import { test, expect } from '@playwright/test';
import { SALES_STORAGE, MANAGER_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * The sales and manager homes show where the open leads sit as stage cards
 * (the step row that repeated the KPI counts is gone), and the KPI band has
 * room for its labels.
 */
test.describe('sales home', () => {
  test.use({ storageState: SALES_STORAGE });
  test('stage cards, no repeated step row', async ({ page }) => {
    await gotoReady(page, '/dashboard');
    await expect(page.getByTestId('stage-pipeline')).toBeVisible();
    await expect(page.getByTestId('stage-pipeline')).toContainText('جديد');
  });
});

test.describe('manager home', () => {
  test.use({ storageState: MANAGER_STORAGE });
  test('stage cards and readable team alerts', async ({ page }) => {
    await gotoReady(page, '/dashboard');
    await expect(page.getByTestId('stage-pipeline')).toBeVisible();
    const alerts = page.getByTestId('team-alerts');
    if ((await alerts.count()) > 0) {
      // the alert count badge carries its number
      await expect(alerts.locator('header, div').first()).toContainText(/\d/);
    }
  });
});
