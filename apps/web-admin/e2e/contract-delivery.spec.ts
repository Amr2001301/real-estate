import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * F10 — the contract keeps the handover date it promised: its page shows it
 * against the one expected now, and a later phase date shows it late and
 * lists it among the delayed contracts.
 */
test('a contract shows its promised handover date and when it is late', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-7);
  const listed = await (await request.get(`${API_BASE}/v1/units?pageSize=1`, { headers })).json();
  const { buildingId } = listed.data[0] as { buildingId: string };
  const unit = await request.post(`${API_BASE}/v1/units`, {
    headers,
    data: { buildingId, code: `PW-CDL-${stamp}`, type: '2BR', area: 100, bedrooms: 2, floor: 1, pricePerMeter: 12_000, deliveryDate: '2027-06-30' },
  });
  expect(unit.status()).toBe(201);
  const unitId = (await unit.json()).id as string;
  const customers = await (await request.get(`${API_BASE}/v1/users?role=CUSTOMER&pageSize=1`, { headers })).json();
  const created = await request.post(`${API_BASE}/v1/contracts`, {
    headers,
    data: { customerId: customers.data[0].id, unitId, totalAmount: 1_200_000, downPayment: 200_000 },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id as string;

  // Signed from its page: the promised date defaults to the unit's.
  await gotoReady(page, `/dashboard/contracts/${id}`);
  const sign = page.getByTestId('sign-contract');
  await expect(sign.locator('input[name="deliveryDate"]')).toHaveValue('2027-06-30');
  page.once('dialog', (d) => void d.accept());
  await sign.getByRole('button').click();
  const delivery = page.getByTestId('contract-delivery');
  await expect(delivery).toContainText('2027-06-30');
  await expect(page.getByTestId('contract-delivery-status')).toHaveText('في الموعد');

  // The unit's date moves later: late, and among the delayed contracts.
  expect((await request.patch(`${API_BASE}/v1/units/${unitId}`, { headers, data: { deliveryDate: '2027-09-30' } })).ok()).toBeTruthy();
  await gotoReady(page, `/dashboard/contracts/${id}`);
  await expect(page.getByTestId('contract-delivery-status')).toHaveText('متأخر 92 يوم');
  await gotoReady(page, '/dashboard/contracts?deliveryDelayed=true');
  await expect(page.locator(`a[href="/dashboard/contracts/${id}"]`).first()).toBeVisible();
});
