import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * «ليا وعليا»: the two tabs with their totals, a card per group, and the
 * selected group's rows. Switching tab and group keeps the period filter.
 */
test('the receivables/payables page shows both sides by group, with their rows', async ({ page }) => {
  await gotoReady(page, '/dashboard/ledger');
  await expect(page.getByTestId('metric-strip')).toBeVisible();
  await expect(page.getByTestId('ledger-tab-receivables')).toHaveAttribute('aria-selected', 'true');
  for (const g of ['installments', 'bookings', 'fees', 'clawbacks']) {
    await expect(page.getByTestId(`ledger-group-${g}`)).toBeVisible();
  }
  await expect(page.getByTestId('ledger-rows')).toBeVisible();

  // Payables, this month: the filter carries over to the other tab.
  await gotoReady(page, '/dashboard/ledger?period=thisMonth');
  await page.getByTestId('ledger-tab-payables').click();
  await expect(page).toHaveURL(/tab=payables/);
  await expect(page).toHaveURL(/period=thisMonth/);
  for (const g of ['commissions', 'bonuses', 'topUps', 'refunds', 'onHold']) {
    await expect(page.getByTestId(`ledger-group-${g}`)).toBeVisible();
  }
  // No raw state or type code reaches the page.
  await expect(page.getByTestId('ledger-rows')).not.toContainText(/pendingApproval|COMMISSION|INSTALLMENT/);
});
