import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const SEEDED_PROJECT_NAME_AR = 'نايل كريست ريزيدنس';

/**
 * F-019 — a plan was bound to exactly one unit. The default new-plan screen now
 * makes a plan for a whole project (or chosen unit types): percentages, a live
 * preview on real units, and a detail page that shows its scope. It is saved as
 * a draft so it does not change which plans other specs see on a unit.
 */
test('a project plan is created from percentages and shows its scope', async ({ page }) => {
  const stamp = Date.now().toString().slice(-7);
  await gotoReady(page, '/dashboard/installments/new');
  await expect(page.getByRole('link', { name: 'خطة لمشروع' })).toBeVisible();
  await expect(page.locator('#unitId')).toHaveCount(0);

  await page.locator('input#name').fill(`خطة مشروع ${stamp}`);
  await page.locator('select#projectId').selectOption({ label: SEEDED_PROJECT_NAME_AR });

  // The preview prices real units of the project from the percentages.
  await expect(page.locator('#section-preview tbody tr').first()).toContainText(/NC-/);

  await page.getByRole('button', { name: 'إنشاء خطة تقسيط' }).click();
  await page.waitForURL(/\/dashboard\/installments\/[0-9a-f-]{36}$/);
  await expect(page.getByText('المشروع كله', { exact: true })).toBeVisible();
  await expect(page.getByText(/كل وحدات المشروع/).first()).toBeVisible();
});

test('the unit-plan form stays one tab away', async ({ page }) => {
  await gotoReady(page, '/dashboard/installments/new?scope=unit');
  await expect(page.locator('#unitId')).toBeDisabled();
});
