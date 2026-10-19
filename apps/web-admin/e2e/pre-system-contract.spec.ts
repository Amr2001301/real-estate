import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * A contract signed before the company used the system: entered with its
 * real signing date, marked as such, and what the customer paid before it
 * was entered is marked paid in one go from its page.
 */
test('the new contract form asks for the real signing date of a pre-system contract', async ({ page }) => {
  await gotoReady(page, '/dashboard/contracts/new');
  const signedAt = page.locator('input[name="signedAt"]');
  await expect(signedAt).not.toHaveAttribute('required', '');
  await page.getByText('عقد مُبرم قبل النظام').click();
  await expect(signedAt).toHaveAttribute('required', '');
  await expect(page.getByText('تاريخ التوقيع الفعلي')).toBeVisible();
});

test('instalments paid before the contract was entered are marked in one go', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-7);

  const units = await (
    await request.get(`${API_BASE}/v1/units?status=AVAILABLE&pageSize=1`, { headers })
  ).json();
  const unit = await request.post(`${API_BASE}/v1/units`, {
    headers,
    data: {
      buildingId: units.data[0].buildingId,
      code: `PW-PRE-${stamp}`,
      type: '2BR',
      area: 100,
      bedrooms: 2,
      bathrooms: 1,
      floor: 1,
      price: 1_200_000,
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
      totalAmount: 1_200_000,
      downPayment: 200_000,
      preSystem: true,
    },
  });
  expect(created.status()).toBe(201);
  const contractId = (await created.json()).id as string;
  expect(
    (await request.post(`${API_BASE}/v1/contracts/${contractId}/sign`, { headers, data: { signedAt: '2025-01-15' } })).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post(`${API_BASE}/v1/installment-plans`, {
        headers,
        data: { contractId, totalMonths: 40, startsAt: '2025-02-01T00:00:00.000Z' },
      })
    ).ok(),
  ).toBeTruthy();

  await gotoReady(page, `/dashboard/contracts/${contractId}`);
  await expect(page.getByTestId('pre-system-badge')).toBeVisible();
  const panel = page.getByTestId('paid-before-system');
  await expect(panel).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await panel.getByRole('button', { name: 'تعليمها مدفوعة قبل النظام' }).click();
  await expect(page.getByTestId('paid-before-system')).toHaveCount(0);

  const contract = await (await request.get(`${API_BASE}/v1/contracts/${contractId}`, { headers })).json();
  const rows = contract.installmentPlan.installments as Array<{ dueDate: string; status: string; paidAt: string | null }>;
  // A day's margin either side of today: the contract was entered today in
  // the company's time zone.
  const dayMs = 24 * 60 * 60 * 1000;
  const due = (r: { dueDate: string }) => new Date(r.dueDate).getTime();
  const before = rows.filter((r) => due(r) < Date.now() - dayMs);
  expect(before.length).toBeGreaterThan(18);
  for (const r of before) {
    expect(r.status).toBe('PAID');
    expect(r.paidAt?.slice(0, 10)).toBe(r.dueDate.slice(0, 10));
  }
  expect(rows.filter((r) => due(r) > Date.now() + dayMs).every((r) => r.status !== 'PAID')).toBe(true);
});
