import { test, expect, type Locator, type Page } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady, pick } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * FG-01 — a deposit paid by cheque leaves its installment unpaid until the
 * cheque clears. The cheque is recorded on the deposit form, then followed on
 * /dashboard/cheques: deposited at the bank, then cleared or bounced.
 *
 * Every step waits for the page to update in place after its server action —
 * no reloads. Under Next 15.5 (React 19.2 canary) that update was sometimes
 * never committed on routes with a loading.tsx: the button stayed busy and the
 * form never redirected. These tests are the regression check for it.
 *
 * Seed: prisma:seed:e2e — contract E2E-CHQ-0001 with 48 open installments
 * (a cleared cheque uses one up; a bounced one leaves it open).
 */

// Both tests take the contract's first open installment.
test.describe.configure({ mode: 'serial' });

async function recordCheque(page: Page, chequeNumber: string): Promise<void> {
  await gotoReady(page, '/dashboard/deposits/new');
  await pick(page, 'contractId', 'E2E-CHQ', 'E2E-CHQ-0001');
  await expect(page.locator('select[name="installmentId"]')).not.toHaveValue('');

  await page.locator('#paymentMethod').selectOption('CHEQUE');
  await page.locator('#chequeNumber').fill(chequeNumber);
  await page.locator('#drawerBankName').fill('E2E Bank');
  await page.locator('#chequeDueDate').fill('2027-01-15');
  await page.getByRole('button', { name: 'تسجيل الدفعة' }).click();
  // Saved: the form redirects to the contract.
  await page.waitForURL(/\/dashboard\/contracts\/[0-9a-f-]{36}$/);
}

/** The cheque's row on the cheques page, found by searching its number. */
async function chequeRow(page: Page, chequeNumber: string): Promise<Locator> {
  await gotoReady(page, `/dashboard/cheques?q=${encodeURIComponent(chequeNumber)}`);
  const row = page.getByTestId('cheques-table').locator('tr', { hasText: chequeNumber });
  await expect(row).toHaveCount(1);
  return row;
}

async function depositAtBank(row: Locator): Promise<void> {
  await row.getByRole('button', { name: 'إيداع بالبنك' }).click();
  await expect(row).toContainText('مودَع بالبنك');
}

test('a cheque is recorded unpaid, deposited at the bank, then cleared', async ({ page }) => {
  const chequeNumber = `PW-CLR-${Date.now()}`;
  await recordCheque(page, chequeNumber);

  const row = await chequeRow(page, chequeNumber);
  await expect(row).toContainText('لم يُودَع');
  await expect(row).toContainText('E2E-CHQ-0001');

  await depositAtBank(row);
  await row.getByRole('button', { name: 'تم الصرف' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'تأكيد الصرف' }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByText('تم الصرف')).toBeVisible();
  // A cleared cheque is final: no further actions.
  await expect(row.getByRole('button')).toHaveCount(0);
});

test('a deposited cheque that bounces is recorded with its reason', async ({ page }) => {
  const chequeNumber = `PW-BNC-${Date.now()}`;
  await recordCheque(page, chequeNumber);

  const row = await chequeRow(page, chequeNumber);
  await depositAtBank(row);
  await row.getByRole('button', { name: 'ارتد' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="bounceReason"]').fill('رصيد غير كافٍ');
  await dialog.getByRole('button', { name: 'تأكيد الارتداد' }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText('مرتد');
  await expect(row).toContainText('رصيد غير كافٍ');
});
