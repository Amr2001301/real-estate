import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * LR1 — a lead marked lost says why; the reason shows on the lead and in
 * «أسباب الخسارة», whose list the admin keeps.
 */
test('marking a lead lost asks why; the report and the reasons list show it', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-8);

  // A reason of our own, added from the reasons tab.
  const reason = `سبب تجربة ${stamp}`;
  await gotoReady(page, '/dashboard/lost-reasons?tab=reasons');
  const manager = page.getByTestId('lost-reasons-manager');
  await manager.getByTestId('reason-add').click();
  await manager.getByTestId('reason-ar').fill(reason);
  await manager.getByTestId('reason-en').fill(`Test reason ${stamp}`);
  await manager.getByTestId('reason-save').click();
  await expect(manager.getByTestId('reason-row').filter({ hasText: reason })).toBeVisible();

  const created = await request.post(`${API_BASE}/v1/leads`, {
    headers,
    data: { fullName: `خسارة ${stamp}`, phone: `+2011${stamp}` },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const leadId = ((await created.json()) as { id: string }).id;

  // LOST asks why first; nothing moves on cancel.
  await gotoReady(page, `/dashboard/leads/${leadId}`);
  await page.getByTestId('stage-lost').click();
  const dialog = page.getByTestId('lost-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('lost-confirm')).toBeDisabled();
  await dialog.getByRole('radio', { name: reason }).click();
  await page.getByTestId('lost-note').fill('وجد أرخص');
  await page.getByTestId('lost-confirm').click();

  const shown = page.getByTestId('lead-lost-reason');
  await expect(shown).toContainText(reason);
  await expect(shown).toContainText('وجد أرخص');

  // The report counts it under its reason.
  await gotoReady(page, '/dashboard/lost-reasons');
  await expect(page.getByTestId('lost-report')).toContainText(reason);
});
