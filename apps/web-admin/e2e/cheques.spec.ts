import { test, expect, type Locator, type Page } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady, pick } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * FG-01 — a deposit paid by cheque leaves its installment unpaid until the
 * cheque clears. The cheque is recorded on the deposit form, then followed on
 * /dashboard/cheques: deposited at the bank, then cleared or bounced.
 *
 * Each step waits for its server action's response (the change is saved once
 * it arrives) and reloads the page, instead of waiting for the page to update
 * in place: on a route under a loading.tsx, Next 15.5 sometimes never applies
 * a server action's re-rendered page in the browser (docs/BACKLOG.md, "Server
 * actions hang"). That is not what these tests are about.
 *
 * Seed: prisma:seed:e2e — contract E2E-CHQ-0001 with 48 open installments
 * (a cleared cheque uses one up; a bounced one leaves it open).
 */

// Both tests take the contract's first open installment.
test.describe.configure({ mode: 'serial' });

/** Click and wait until the server action posted to `path` has answered. */
async function submitAction(page: Page, path: string, click: () => Promise<void>): Promise<void> {
  const answered = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === path,
  );
  await click();
  expect((await answered).status()).toBeLessThan(400);
}

async function recordCheque(page: Page, chequeNumber: string): Promise<void> {
  await gotoReady(page, '/dashboard/deposits/new');
  await pick(page, 'contractId', 'E2E-CHQ', 'E2E-CHQ-0001');
  await expect(page.locator('select[name="installmentId"]')).not.toHaveValue('');

  await page.locator('#paymentMethod').selectOption('CHEQUE');
  await page.locator('#chequeNumber').fill(chequeNumber);
  await page.locator('#drawerBankName').fill('E2E Bank');
  await page.locator('#chequeDueDate').fill('2027-01-15');
  await submitAction(page, '/dashboard/deposits/new', () =>
    page.getByRole('button', { name: 'تسجيل الدفعة' }).click(),
  );
}

/** The cheque's row on the cheques page, found by searching its number. */
async function chequeRow(page: Page, chequeNumber: string): Promise<Locator> {
  await gotoReady(page, `/dashboard/cheques?q=${encodeURIComponent(chequeNumber)}`);
  const row = page.getByTestId('cheques-table').locator('tr', { hasText: chequeNumber });
  await expect(row).toHaveCount(1);
  return row;
}

async function depositAtBank(page: Page, chequeNumber: string): Promise<Locator> {
  const row = await chequeRow(page, chequeNumber);
  await submitAction(page, '/dashboard/cheques', () =>
    row.getByRole('button', { name: 'إيداع بالبنك' }).click(),
  );
  const after = await chequeRow(page, chequeNumber);
  await expect(after).toContainText('مودَع بالبنك');
  return after;
}

test('a cheque is recorded unpaid, deposited at the bank, then cleared', async ({ page }) => {
  const chequeNumber = `PW-CLR-${Date.now()}`;
  await recordCheque(page, chequeNumber);

  const row = await chequeRow(page, chequeNumber);
  await expect(row).toContainText('لم يُودَع');
  await expect(row).toContainText('E2E-CHQ-0001');

  const deposited = await depositAtBank(page, chequeNumber);
  await deposited.getByRole('button', { name: 'تم الصرف' }).click();
  await submitAction(page, '/dashboard/cheques', () =>
    page.getByRole('dialog').getByRole('button', { name: 'تأكيد الصرف' }).click(),
  );

  const cleared = await chequeRow(page, chequeNumber);
  await expect(cleared.getByText('تم الصرف')).toBeVisible();
  // A cleared cheque is final: no further actions.
  await expect(cleared.getByRole('button')).toHaveCount(0);
});

test('a deposited cheque that bounces is recorded with its reason', async ({ page }) => {
  const chequeNumber = `PW-BNC-${Date.now()}`;
  await recordCheque(page, chequeNumber);

  const deposited = await depositAtBank(page, chequeNumber);
  await deposited.getByRole('button', { name: 'ارتد' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="bounceReason"]').fill('رصيد غير كافٍ');
  await submitAction(page, '/dashboard/cheques', () =>
    dialog.getByRole('button', { name: 'تأكيد الارتداد' }).click(),
  );

  const bounced = await chequeRow(page, chequeNumber);
  await expect(bounced).toContainText('مرتد');
  await expect(bounced).toContainText('رصيد غير كافٍ');
});
