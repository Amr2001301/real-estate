import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

test.use({ storageState: ADMIN_STORAGE });

/**
 * A contract is not signed without a way to pay. Without a plan the contract page says so in place
 * of the signing control; a cash plan (one payment) set in the plan section unlocks signing. The API
 * refuses the signature too.
 */
test('a contract is signed only once it has a payment plan — cash here', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-7);
  const units = await (await request.get(`${API_BASE}/v1/units?status=AVAILABLE&pageSize=1`, { headers })).json();
  const unit = await request.post(`${API_BASE}/v1/units`, {
    headers,
    data: { buildingId: units.data[0].buildingId, code: `PW-PAY-${stamp}`, type: '2BR', area: 100, bedrooms: 2, bathrooms: 1, floor: 1, price: 900_000 },
  });
  expect(unit.status()).toBe(201);
  const customers = await (await request.get(`${API_BASE}/v1/users?role=CUSTOMER&pageSize=1`, { headers })).json();
  const created = await request.post(`${API_BASE}/v1/contracts`, {
    headers,
    data: { customerId: customers.data[0].id, unitId: (await unit.json()).id, totalAmount: 900_000 },
  });
  expect(created.status()).toBe(201);
  const contractId = (await created.json()).id as string;

  // The API refuses to sign it.
  const refused = await request.post(`${API_BASE}/v1/contracts/${contractId}/sign`, {
    headers,
    data: { signedAt: new Date().toISOString().slice(0, 10) },
  });
  expect(refused.status()).toBe(400);
  expect((await refused.json()).code).toBe('PAYMENT_PLAN_REQUIRED');

  // The page says what is missing instead of offering to sign.
  await gotoReady(page, `/dashboard/contracts/${contractId}`);
  await expect(page.getByTestId('sign-needs-plan')).toBeVisible();
  await expect(page.getByTestId('sign-contract')).toHaveCount(0);

  // A cash plan, set in the plan section: one payment, no months.
  await gotoReady(page, `/dashboard/contracts/${contractId}?tab=installments`);
  const form = page.getByTestId('create-plan-form');
  await form.getByTestId('plan-method').selectOption('cash');
  await expect(form.locator('input[name="totalMonths"]')).toHaveCount(0);
  await form.locator('input[name="startsAt"]').fill(new Date().toISOString().slice(0, 10));
  await form.getByRole('button').click();
  await expect(page.getByTestId('create-plan-form')).toHaveCount(0);

  await gotoReady(page, `/dashboard/contracts/${contractId}`);
  await expect(page.getByTestId('sign-contract')).toBeVisible();
  await expect(page.getByTestId('sign-needs-plan')).toHaveCount(0);

  // The cash plan is one payment for the whole price (no booking here).
  const contract = await (await request.get(`${API_BASE}/v1/contracts/${contractId}`, { headers })).json();
  const rows = contract.installmentPlan.installments as Array<{ type: string; amount: string | number }>;
  expect(contract.installmentPlan.totalMonths).toBe(0);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.type).toBe('DOWN_PAYMENT');
  expect(Number(rows[0]!.amount)).toBe(900_000);
});
