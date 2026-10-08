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

/**
 * The open SearchSelect's options. Scoped to the listbox: a bare
 * getByRole('option') also matches the <option>s of the page's <select>s.
 */
const options = (page: Page) => page.getByRole('listbox').getByRole('option');

/** Type into a SearchSelect, pick the first option matching `text`. */
async function pick(page: Page, field: string, query: string, text: string | RegExp) {
  // The <Field> label names the combobox (htmlFor = id = field name).
  await page.locator(`#${field}`).fill(query);
  const option = options(page).filter({ hasText: text }).first();
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

    const option = options(page).filter({ hasText: 'NC-A-' }).first();
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
    const first = options(page).first();
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

test.describe('Record deposit — contract picker', () => {
  test('a contract is searched, and ?contractId= pre-selects it', async ({ page }) => {
    await page.goto('/dashboard/deposits/new');
    await page.locator('#contractId').focus();
    const first = options(page).first();
    await expect(first, 'the e2e seed has contracts').toBeVisible();
    const label = (await first.innerText()).trim();
    await first.click();
    const contractId = await page.locator('input[name="contractId"]').inputValue();
    expect(contractId).toMatch(UUID);

    // Opened from a contract page: the contract arrives selected, no search.
    await page.goto(`/dashboard/deposits/new?contractId=${contractId}`);
    await expect(page.locator('input[name="contractId"]')).toHaveValue(contractId);
    await expect(page.locator('#contractId')).toHaveValue(label);
  });
});

test.describe('New installment plan — unit picker', () => {
  test('waits for a project, then searches units without a plan', async ({ page }) => {
    await page.goto('/dashboard/installments/new');
    await expect(page.locator('#unitId')).toBeDisabled();
    await page.locator('select[name="projectId"]').selectOption({ label: SEEDED_PROJECT_NAME_AR });
    await expect(page.locator('#unitId')).toBeEnabled();
    await pick(page, 'unitId', 'nc-a', 'NC-A-');
  });
});

/** The seeded broker with an approved lead that already has a sales rep. */
async function seededBrokerLead(page: Page) {
  const res = await page.request.get(
    '/api-proxy/broker-leads?brokerApprovalStatus=APPROVED&assigned=true&pageSize=1',
  );
  expect(res.ok()).toBe(true);
  const lead = (await res.json()).data[0] as { brokerId: string; projectInterestId: string };
  expect(lead, 'the e2e seed has an approved, assigned broker lead').toBeTruthy();
  return lead;
}

test.describe('Broker unit access — unit picker', () => {
  test('searches the available units of the chosen project', async ({ page }) => {
    const { brokerId } = await seededBrokerLead(page);
    await page.goto(`/dashboard/brokers/${brokerId}/access?tab=units`);
    await expect(page.locator('#unitId')).toBeDisabled();
    // The option label is "name — city"; select it by value.
    const project = page.locator('#_project option', { hasText: SEEDED_PROJECT_NAME_AR });
    await page.locator('#_project').selectOption((await project.getAttribute('value'))!);
    await pick(page, 'unitId', 'nc-a', 'NC-A-');
  });
});

test.describe('Admin broker reservation — lead and unit pickers', () => {
  test("lists the broker's assigned leads and the project's available units", async ({ page }) => {
    const { brokerId, projectInterestId } = await seededBrokerLead(page);
    await page.goto(
      `/dashboard/broker-reservations/new?brokerId=${brokerId}&projectId=${projectInterestId}`,
    );
    await pick(page, 'leadId', 'E2E Broker1', 'E2E Broker1 Client');

    await page.locator('#unitId').focus();
    const unit = options(page).first();
    await expect(unit, 'the project has available units').toBeVisible();
    await unit.click();
    await expect(page.locator('input[name="unitId"]')).toHaveValue(UUID);
  });
});
