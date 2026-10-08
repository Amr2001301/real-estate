import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';

test.use({ storageState: ADMIN_STORAGE });

/**
 * New-reservation pickers search the API as the user types.
 *
 * They used to be <select>s filled from one `?pageSize=200` fetch, so the
 * 201st available unit, lead or client could not be reserved at all. These
 * drive the real form against the seeded backend (prisma:seed:e2e): the
 * Nile Crest units (NC-A-*) and the E2E customers.
 */
const UUID = /^[0-9a-f-]{36}$/;
const SEEDED_PROJECT_NAME_AR = 'نايل كريست ريزيدنس';

test.describe('New reservation — searchable pickers', () => {
  test('the unit picker finds a unit by part of its code and submits its id', async ({ page }) => {
    await page.goto('/dashboard/reservations/new');

    // The <Field> label names the combobox (htmlFor = id = field name).
    const unitSearch = page.locator('#unitId');
    await expect(unitSearch).toHaveAttribute('placeholder', 'ابحث بكود الوحدة…');
    // Lower case on purpose: the API match is case-insensitive.
    await unitSearch.fill('nc-a');

    const option = page.getByRole('option').filter({ hasText: 'NC-A-' }).first();
    await expect(option, 'did you run prisma:seed:e2e against the API DB?').toBeVisible();
    // Translatable fields arrive as {ar, en} (X-Raw-Translatable), so the
    // project name still shows in the label.
    await expect(option).toContainText(SEEDED_PROJECT_NAME_AR);
    await option.click();

    await expect(page.locator('input[name="unitId"]')).toHaveValue(UUID);
    await expect(unitSearch).toHaveValue(/NC-A-/);
  });

  test('the client picker finds a registered client by name', async ({ page }) => {
    await page.goto('/dashboard/reservations/new');
    await page.getByText('عميل مسجل', { exact: true }).click();

    await page.locator('#clientId').fill('E2E Customer');
    const option = page.getByRole('option').filter({ hasText: 'E2E Customer' }).first();
    await expect(option).toBeVisible();
    await option.click();

    await expect(page.locator('input[name="clientId"]')).toHaveValue(UUID);
  });
});
