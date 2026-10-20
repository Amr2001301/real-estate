import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';
// A month that has not started: its target reads "not started", not "needs follow-up".
const FUTURE = '2099-12';

test('a target for a month not yet started reads as not started, value and units both shown', async ({
  page,
  request,
  context,
}) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const sales = (await (await request.get(`${API_BASE}/v1/users?role=SALES&pageSize=1`, { headers })).json()).data[0];
  const set = await request.post(`${API_BASE}/v1/sales-targets`, {
    headers,
    data: { salesId: sales.id, period: FUTURE, amountTarget: 1_000_000, unitsTarget: 2 },
  });
  expect(set.ok(), await set.text()).toBe(true);

  await gotoReady(page, `/dashboard/targets?period=${FUTURE}`);
  const row = page.getByTestId('target-row').filter({ hasText: sales.fullName });
  await expect(row.getByTestId('target-status')).toHaveText('لم يبدأ');

  await gotoReady(page, `/dashboard/sales/performance?period=${FUTURE}&salesId=${sales.id}`);
  await expect(page.getByTestId('team-status')).toHaveText('لم يبدأ');
  const rep = page.getByTestId('rep-performance');
  await expect(rep).toContainText('القيمة');
  await expect(rep).toContainText('الوحدات');
  await expect(rep).toContainText('0 / 2');
});
