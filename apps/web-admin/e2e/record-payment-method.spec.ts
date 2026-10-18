import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * The contract page's per-row "سجّل دفعة" asked for no payment method: the
 * payment was saved with none, so the method reports and the cash/bank
 * reconciliation missed it. It now asks, like the "تسجيل دفعة" page.
 */
test('a payment recorded from the contract page has its payment method', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const list = await request.get(`${API_BASE}/v1/contracts?q=E2E-CHQ-0001`, { headers });
  const contractId = (await list.json()).data[0].id as string;

  await gotoReady(page, `/dashboard/contracts/${contractId}`);
  await page.getByRole('button', { name: 'سجّل دفعة' }).first().click();
  const form = page.getByTestId('record-payment-form');
  await form.locator('select[name="paymentMethod"]').selectOption('BANK_TRANSFER');
  await form.locator('input[name="transferRef"]').fill(`PW-ROW-${Date.now()}`);
  await form.getByRole('button', { name: 'تأكيد الدفع' }).click();
  await expect(page.getByTestId('record-payment-form')).toHaveCount(0);

  const deposits = await (
    await request.get(`${API_BASE}/v1/deposits?contractId=${contractId}&pageSize=1`, { headers })
  ).json();
  expect(deposits.data[0].paymentMethod).toBe('BANK_TRANSFER');
});
