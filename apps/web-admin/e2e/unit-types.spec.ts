import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * F10 — units were typed from a fixed residential list, so a shop, an office,
 * a clinic or a garage could not be entered. The admin manages the company's
 * types (each with a usage); the unit form offers them, and hides bedrooms
 * for a unit that is not residential.
 */
test('the admin adds a unit type and the unit form offers it', async ({ page }) => {
  const stamp = Date.now().toString().slice(-7);
  await gotoReady(page, '/dashboard/units/types');
  await expect(page.getByTestId('unit-type-row').first()).toBeVisible();

  const add = page.getByTestId('unit-type-add');
  await add.locator('input[name="ar"]').fill(`صيدلية ${stamp}`);
  await add.locator('input[name="en"]').fill(`Pharmacy ${stamp}`);
  await add.locator('select[name="usage"]').selectOption('MEDICAL');
  await add.getByRole('button', { name: 'إضافة نوع' }).click();
  await expect(page.getByText('تم الحفظ.')).toBeVisible();
  await expect(page.getByTestId('unit-type-row').filter({ hasText: `Pharmacy ${stamp}` })).toHaveCount(1);

  await gotoReady(page, '/dashboard/units/new');
  const type = page.locator('select[name="type"]');
  await expect(type.locator('option', { hasText: `صيدلية ${stamp}` })).toHaveCount(1);
  await expect(type.locator('optgroup[label="تجاري"] option', { hasText: 'محل تجاري' })).toHaveCount(1);

  // Residential → bedrooms; an office → none.
  await type.selectOption('2BR');
  await expect(page.locator('input[name="bedrooms"]:not([type="hidden"])')).toBeVisible();
  await type.selectOption('Office');
  await expect(page.locator('input[name="bedrooms"]:not([type="hidden"])')).toHaveCount(0);
});
