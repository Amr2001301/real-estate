import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * Receivables & payables: the position band, both sides with their groups,
 * and the chosen group's detail. Choosing a group keeps the period filter.
 */
test('the receivables & payables page shows both sides by group, with the detail', async ({ page }) => {
  await gotoReady(page, '/dashboard/ledger');
  await expect(page.getByTestId('metric-strip')).toBeVisible();
  await expect(page.getByTestId('ledger-side-receivables')).toBeVisible();
  await expect(page.getByTestId('ledger-side-payables')).toBeVisible();
  for (const g of ['installments', 'bookings', 'fees', 'clawbacks', 'commissions', 'bonuses', 'topUps', 'refunds', 'onHold']) {
    await expect(page.getByTestId(`ledger-group-${g}`)).toBeVisible();
  }
  await expect(page.getByTestId('ledger-rows')).toBeVisible();

  // A payables group, this month: the period carries over.
  await gotoReady(page, '/dashboard/ledger?period=thisMonth');
  await page.getByTestId('ledger-group-commissions').click();
  await expect(page).toHaveURL(/group=commissions/);
  await expect(page).toHaveURL(/period=thisMonth/);
  await expect(page.getByTestId('ledger-group-commissions')).toHaveAttribute('aria-current', 'true');
  // No raw state or type code reaches the page.
  await expect(page.getByTestId('ledger-rows')).not.toContainText(/pendingApproval|COMMISSION|INSTALLMENT|onItsWay/);
});
