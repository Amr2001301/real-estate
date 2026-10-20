import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { ADMIN_EMAIL, COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';
const CAP_KEY = 'pricing.maxDiscountPct';
const APPROVE = 'pricing:approve-discount';

/**
 * F28 — a price change above the discount cap, by someone who can't approve
 * it, showed only «ليست لديك صلاحية الوصول إلى هذا المورد»: the dashboard
 * replaced every 403 with that line. The API's own reason is now shown.
 */
test('a discount over the cap says so', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const contractId = (
    await (await request.get(`${API_BASE}/v1/contracts?q=E2E-CHQ-0001`, { headers })).json()
  ).data[0].id as string;
  const admins = (
    await (await request.get(`${API_BASE}/v1/users?role=ADMIN&pageSize=50`, { headers })).json()
  ).data as Array<{ id: string; email: string }>;
  const adminId = admins.find((u) => u.email === ADMIN_EMAIL)!.id;
  const setCap = async (value: number) =>
    expect((await request.patch(`${API_BASE}/v1/settings/${CAP_KEY}`, { headers, data: { value } })).ok()).toBeTruthy();
  const setApprover = async (on: boolean) =>
    expect(
      (
        await request.patch(`${API_BASE}/v1/users/${adminId}/permissions`, {
          headers,
          data: on ? { addPermissionCodes: [APPROVE] } : { removePermissionCodes: [APPROVE] },
        })
      ).ok(),
    ).toBeTruthy();

  await setCap(1);
  await setApprover(false);
  try {
    await gotoReady(page, `/dashboard/contracts/${contractId}`);
    // The plan changes sit in tabs: open the price one first.
    await page.getByRole('tab', { name: 'تعديل سعر العقد' }).click();
    const form = page.locator('form:has([data-testid="price-submit"])');
    await form.locator('input[name="totalAmount"]').fill('1000');
    await form.locator('input[name="reason"]').fill('PW discount over cap');
    page.once('dialog', (d) => d.accept());
    await form.getByTestId('price-submit').click();
    await expect(page.getByText('أكبر من الحد المسموح (1%)')).toBeVisible();
    await expect(page.getByText('ليست لديك صلاحية الوصول إلى هذا المورد')).toHaveCount(0);
  } finally {
    await setApprover(true);
    await setCap(100);
  }
});
