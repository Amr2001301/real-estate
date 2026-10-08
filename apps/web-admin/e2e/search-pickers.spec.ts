import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';

test.use({ storageState: ADMIN_STORAGE });

/**
 * Create forms search units, leads and clients on the API as the user types
 * (SearchSelect).
 *
 * They used to be <select>s filled from one `?pageSize=100|200|500` fetch, so
 * any record past that page could not be chosen at all. These drive the real
 * forms against the seeded backend (prisma:seed:e2e): the Nile Crest units
 * (NC-A-*) and the E2E customers.
 */
const UUID = /^[0-9a-f-]{36}$/;
const SEEDED_PROJECT_NAME_AR = 'نايل كريست ريزيدنس';

/** Type into a SearchSelect, pick the first option matching `text`. */
async function pick(page: Page, field: string, query: string, text: string | RegExp) {
  // The <Field> label names the combobox (htmlFor = id = field name).
  await page.locator(`#${field}`).fill(query);
  const option = page.getByRole('option').filter({ hasText: text }).first();
  await expect(option, 'did you run prisma:seed:e2e against the API DB?').toBeVisible();
  await option.click();
  await expect(page.locator(`input[name="${field}"]`)).toHaveValue(UUID);
  return option;
}

test.describe('New reservation — searchable pickers', () => {
  test('the unit picker finds a unit by part of its code and submits its id', async ({ page }) => {
    await page.goto('/dashboard/reservations/new');

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
    await pick(page, 'clientId', 'E2E Customer', 'E2E Customer');
  });
});

test.describe('New contract — searchable pickers', () => {
  test('customer and unit are searched, not preloaded', async ({ page }) => {
    await page.goto('/dashboard/contracts/new');
    await pick(page, 'customerId', 'E2E Customer', 'E2E Customer');
    const unit = await pick(page, 'unitId', 'nc-a', 'NC-A-');
    await expect(unit).toBeHidden(); // list closed after the pick
  });
});

test.describe('New visit — searchable pickers', () => {
  test('a lead is picked from the first page the API returns', async ({ page }) => {
    await page.goto('/dashboard/visits/new');
    await page.locator('#leadId').focus();
    const first = page.getByRole('option').first();
    await expect(first, 'the e2e seed has leads').toBeVisible();
    await first.click();
    await expect(page.locator('input[name="leadId"]')).toHaveValue(UUID);
  });

  test('the unit picker waits for a project, then searches inside it', async ({ page }) => {
    await page.goto('/dashboard/visits/new');
    await expect(page.locator('#unitId')).toBeDisabled();

    await page.locator('select[name="projectId"]').selectOption({ label: SEEDED_PROJECT_NAME_AR });
    await expect(page.locator('#unitId')).toBeEnabled();
    await pick(page, 'unitId', 'nc-a', 'NC-A-');
  });
});

test.describe('New lead — unit of interest', () => {
  test('is searched inside the chosen project', async ({ page }) => {
    await page.goto('/dashboard/leads/new');
    await page
      .locator('select[name="projectInterestId"]')
      .selectOption({ label: SEEDED_PROJECT_NAME_AR });
    await pick(page, 'unitInterestId', 'nc-a', 'NC-A-');
  });
});

test.describe('New maintenance request — customer picker', () => {
  test('picking a customer loads that customer’s units', async ({ page }) => {
    await page.goto('/dashboard/maintenance/new');
    const unitSelect = page.locator('select[name="unitId"]');
    await expect(unitSelect).toBeDisabled();

    // The e2e seed gives E2E Customer a contract (and so an owned unit).
    await pick(page, 'customerId', 'E2E Customer', /^E2E Customer(?! Two)/);
    await expect(unitSelect).toBeEnabled();
    await expect(unitSelect.locator('option')).not.toHaveCount(1);
  });
});
