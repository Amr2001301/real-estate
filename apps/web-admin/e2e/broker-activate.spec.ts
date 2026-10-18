import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * A broker firm is created "قيد الانضمام", and nothing on its page said its
 * agents could not use the portal until it was activated (the status form
 * sits on the edit page). A pending firm's page now says so, with the button.
 */
test('a pending broker firm is activated from its page', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const created = await request.post(`${API_BASE}/v1/brokers`, {
    headers,
    data: { companyName: `PW Brokerage ${Date.now().toString().slice(-7)}` },
  });
  expect(created.status()).toBe(201);
  const broker = await created.json();
  expect(broker.status).toBe('PENDING');

  await gotoReady(page, `/dashboard/brokers/${broker.id}`);
  const notice = page.getByTestId('broker-pending-notice');
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'تفعيل الشركة' }).click();
  await expect(page.getByTestId('broker-pending-notice')).toHaveCount(0);

  const after = await (await request.get(`${API_BASE}/v1/brokers/${broker.id}`, { headers })).json();
  expect(after.status).toBe('ACTIVE');
});
