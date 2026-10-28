import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * DUP1 — a customer added twice shows under «فرص مكررة»; merging keeps one
 * lead and the customer leaves the list.
 */
test('a customer added twice is listed as a duplicate and merged into one lead', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-8);
  const name = `مكرر ${stamp}`;
  const phone = `+2012${stamp}`;
  for (let i = 0; i < 2; i++) {
    const created = await request.post(`${API_BASE}/v1/leads`, { headers, data: { fullName: name, phone } });
    expect(created.ok(), await created.text()).toBe(true);
  }

  await gotoReady(page, '/dashboard/leads');
  await page.getByTestId('leads-duplicates').click();
  await page.waitForURL(/\/dashboard\/leads\/duplicates/);
  const group = page.getByTestId('duplicate-group').filter({ hasText: name });
  await expect(group.getByTestId('duplicate-lead')).toHaveCount(2);

  page.once('dialog', (d) => d.accept());
  await group.getByTestId('duplicate-merge').click();
  await expect(page.getByTestId('duplicate-group').filter({ hasText: name })).toHaveCount(0);
});
