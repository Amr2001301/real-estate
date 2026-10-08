import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * FG-05 — an admin reverses a payment from its page (the installment reopens),
 * deletes it and restores it. The API did this safely before; there was no
 * button for it.
 *
 * The payment is recorded through the API (a bank transfer pays its
 * installment at once) on the seeded contract E2E-CHQ-0001, with the admin
 * session's own token — a fresh login would exceed the API's 5-per-minute
 * login throttle right after global-setup's four.
 */
async function recordTransfer(request: APIRequestContext, context: BrowserContext): Promise<string> {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };

  const list = await request.get(`${API_BASE}/v1/contracts?q=E2E-CHQ-0001`, { headers });
  const contractId = (await list.json()).data[0].id as string;
  const contract = await (await request.get(`${API_BASE}/v1/contracts/${contractId}`, { headers })).json();
  const open = contract.installmentPlan.installments.find((i: { status: string }) => i.status !== 'PAID');
  expect(open).toBeTruthy();

  const res = await request.post(`${API_BASE}/v1/deposits`, {
    headers,
    data: {
      contractId,
      installmentId: open.id,
      amount: Number(open.amount),
      paymentMethod: 'BANK_TRANSFER',
      transfer: { referenceNumber: `PW-FG05-${Date.now()}` },
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
}

test('a paying deposit is reversed, deleted and restored from its page', async ({ page, request, context }) => {
  const id = await recordTransfer(request, context);
  await gotoReady(page, `/dashboard/deposits/${id}`);

  // Reverse: needs a reason; afterwards the payment no longer pays, so the
  // button is gone.
  await page.getByRole('button', { name: 'عكس الدفعة' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('textarea[name="reason"]').fill('سُجّلت على القسط الخطأ');
  await dialog.getByRole('button', { name: 'تأكيد العكس' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'عكس الدفعة' })).toHaveCount(0);

  // Delete, then restore.
  await page.getByRole('button', { name: 'حذف الدفعة' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد الحذف' }).click();
  await expect(page.getByTestId('deposit-deleted')).toBeVisible();

  await page.getByRole('button', { name: 'استعادة الدفعة' }).click();
  await expect(page.getByTestId('deposit-deleted')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'حذف الدفعة' })).toBeVisible();
});
