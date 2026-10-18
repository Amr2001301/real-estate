import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * A contract converted without a signing date is unsigned, and nothing on its
 * page signed it: it stayed out of contract value and sales, with no broker
 * commission or sales bonus. The admin now signs it from the contract page.
 *
 * The unsigned contract is made through the API (a fresh unit, the seeded
 * customer) with the admin session's own token — a fresh login would exceed
 * the API's 5-per-minute login throttle right after global-setup's four.
 */
test('an admin signs an unsigned contract from its page', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-7);

  const units = await (
    await request.get(`${API_BASE}/v1/units?status=AVAILABLE&pageSize=1`, { headers })
  ).json();
  const buildingId = units.data[0].buildingId as string;
  const unit = await request.post(`${API_BASE}/v1/units`, {
    headers,
    data: {
      buildingId,
      code: `PW-SIGN-${stamp}`,
      type: '2BR',
      area: 100,
      bedrooms: 2,
      bathrooms: 1,
      floor: 1,
      price: 1_000_000,
    },
  });
  expect(unit.status()).toBe(201);
  const customers = await (
    await request.get(`${API_BASE}/v1/users?role=CUSTOMER&pageSize=1`, { headers })
  ).json();
  const created = await request.post(`${API_BASE}/v1/contracts`, {
    headers,
    data: {
      customerId: customers.data[0].id,
      unitId: (await unit.json()).id,
      totalAmount: 1_000_000,
    },
  });
  expect(created.status()).toBe(201);
  const contractId = (await created.json()).id as string;

  await gotoReady(page, `/dashboard/contracts/${contractId}`);
  const sign = page.getByTestId('sign-contract');
  await expect(sign).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await sign.getByRole('button', { name: 'توقيع العقد' }).click();
  await expect(page.getByTestId('sign-contract')).toHaveCount(0);

  const after = await (
    await request.get(`${API_BASE}/v1/contracts/${contractId}`, { headers })
  ).json();
  expect(after.signedAt).toBeTruthy();
  expect(after.status).toBe('ACTIVE');
});
