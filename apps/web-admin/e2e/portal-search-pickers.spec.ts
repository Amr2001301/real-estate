import { test, expect } from '@playwright/test';
import { BROKER_STORAGE } from './global-setup';
import { gotoReady, pick, pickFirst } from './helpers/pickers';

test.use({ storageState: BROKER_STORAGE });

/**
 * Broker portal create forms search leads and units on the API as the broker
 * types (SearchSelect), inside the broker's own scope.
 *
 * They used to be <select>s filled from one `?pageSize=200` fetch of the
 * portal lists, so a broker's lead or unit 201 could not be chosen. Seed:
 * prisma:seed:e2e — broker1 (E2E-BROKER-1) with the approved, assigned lead
 * "E2E Broker1 Client" on a project broker1 has access to.
 */
test.describe('Portal — new reservation', () => {
  test('an approved lead is searched, then a unit of its project', async ({ page }) => {
    await gotoReady(page, '/portal/reservations/new');
    await pick(page, 'leadId', 'E2E Broker1', 'E2E Broker1 Client');
    await expect(page.locator('#leadId')).toHaveValue(/E2E Broker1 Client/);
    await pickFirst(page, 'unitId');
  });
});

test.describe('Portal — new lead', () => {
  test('the unit of interest is searched among the broker’s units', async ({ page }) => {
    await gotoReady(page, '/portal/leads/new');
    await pickFirst(page, 'unitInterestId');
  });
});

test.describe('Portal — new visit request', () => {
  test('picking a lead fills its project; the unit is searched inside it', async ({ page }) => {
    await gotoReady(page, '/portal/visits/new');
    await pick(page, 'leadId', 'E2E Broker1', 'E2E Broker1 Client');
    await expect(page.locator('select[name="projectId"]')).not.toHaveValue('');
    await pickFirst(page, 'unitId');
  });
});
