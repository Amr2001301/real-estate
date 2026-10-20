import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

test.use({ storageState: ADMIN_STORAGE });

/**
 * The audit log: four summary cards, then the events grouped by day, each
 * with its kind icon, its name, its area and who did it — no raw HTTP
 * method ("POST", "PATCH") on the page.
 */
test('the audit log groups events by day and shows them by name', async ({ page, request, context }) => {
  // At least one event to show (on a fresh database the log can be empty):
  // a settings change is audited. The same unused key settings-known-keys.spec.ts sets.
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const res = await request.patch(`${API_BASE}/v1/settings/security.requireMfa`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG },
    data: { value: true },
  });
  expect(res.ok()).toBeTruthy();

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
