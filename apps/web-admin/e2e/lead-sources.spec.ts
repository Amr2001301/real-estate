import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * There was no screen for lead sources: a company had only the ones it was
 * seeded with and could not add, rename or retire one. The admin now manages
 * them from the leads page, and a switched-off source is not offered for a
 * new lead.
 */
test('the admin adds, renames and switches off a lead source', async ({ page }) => {
  const stamp = Date.now().toString().slice(-7);

  await gotoReady(page, '/dashboard/leads');
  await page.getByRole('link', { name: 'مصادر العملاء' }).click();
  await expect(page).toHaveURL(/\/dashboard\/leads\/sources/);

  const add = page.getByTestId('lead-source-add');
  await add.locator('input[name="ar"]').fill(`معرض ${stamp}`);
  await add.locator('input[name="en"]').fill(`Expo ${stamp}`);
  await add.getByRole('button', { name: 'إضافة مصدر' }).click();

  const row = page
    .getByTestId('lead-source-row')
    .filter({ has: page.locator(`input[value="Expo ${stamp}"]`) });
  await expect(row).toHaveCount(1);
  await row.locator('input[name="ar"]').fill(`معرض العقارات ${stamp}`);
  await row.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.locator(`input[value="معرض العقارات ${stamp}"]`)).toHaveCount(1);

  const renamed = page
    .getByTestId('lead-source-row')
    .filter({ has: page.locator(`input[value="Expo ${stamp}"]`) });
  await renamed.getByRole('button', { name: 'إيقاف' }).click();
  await expect(renamed.getByRole('button', { name: 'تفعيل' })).toBeVisible();

  await gotoReady(page, '/dashboard/leads/new');
  const options = await page.locator('select[name="sourceId"] option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  expect(options.join('|')).not.toContain(`معرض العقارات ${stamp}`);
});
