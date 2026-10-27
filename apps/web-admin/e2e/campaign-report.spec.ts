import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * MC3 — the campaigns report lists each campaign with what it cost and
 * brought, filters by channel, and offers PDF and Excel copies.
 */
test('the campaigns report ranks campaigns with their spend, and filters by channel', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-8);
  const name = `Pw report ${stamp}`;
  const created = await request.post(`${API_BASE}/v1/campaigns`, { headers, data: { name, channel: 'TIKTOK' } });
  expect(created.ok(), await created.text()).toBe(true);
  const { id } = await created.json();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
  const spent = await request.post(`${API_BASE}/v1/campaigns/${id}/spend`, { headers, data: { amount: 1234, spentOn: today } });
  expect(spent.ok(), await spent.text()).toBe(true);

  await gotoReady(page, '/dashboard/campaigns');
  await page.getByTestId('campaign-report-open').click();
  await page.waitForURL(/\/dashboard\/campaigns\/report/);
  await page.getByTestId('report-preset-all').click();
  await page.waitForURL(/from=&to=/);

  const row = page.getByTestId('report-campaign-row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row).toContainText('1,234');

  // Another channel leaves it out.
  await page.locator('select[name="channel"]').selectOption('GOOGLE');
  await page.getByRole('button', { name: 'تطبيق' }).click();
  await page.waitForURL(/channel=GOOGLE/);
  await expect(page.getByTestId('report-campaign-row').filter({ hasText: name })).toHaveCount(0);

  // The Excel copy downloads.
  const xlsx = await request.get(`${API_BASE}/v1/campaigns/report/export.xlsx`, { headers });
  expect(xlsx.ok()).toBe(true);
  expect(xlsx.headers()['content-type']).toContain('spreadsheetml');
});
