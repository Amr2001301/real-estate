import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * The financial report: what came in and the collection rate up top with the
 * six months of collected against due, the three key figures, and the
 * overdue section — one calm line when nothing is late. No raw status code
 * ("PENDING") reaches the page.
 */
test('the financial report leads with collections, the rate and the months', async ({ page }) => {
  await gotoReady(page, '/dashboard/reports/financial');
  await expect(page.getByTestId('fin-hero')).toBeVisible();
  await expect(page.getByTestId('fin-collected')).toHaveText(/\d/);
  // Summary figures read in ألف / مليون / مليار, the exact amount on hover.
  await expect(page.getByTestId('fin-collected').locator('[title]').first()).toHaveAttribute('title', /\d{1,3}(,\d{3})*/);
  await expect(page.getByTestId('fin-rate')).toHaveText(/^\d+%$/);
  for (const id of ['fin-kpi-contracts', 'fin-kpi-outstanding', 'fin-kpi-overdue', 'fin-distribution', 'fin-upcoming']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }

  // Six months, or a note when there is nothing to draw.
  const months = page.getByTestId('fin-cashflow-month');
  if (await page.getByTestId('fin-cashflow').count()) await expect(months).toHaveCount(6);

  // Overdue: either the all-clear line or the overdue panel, never both.
  const clear = await page.getByTestId('fin-all-clear').count();
  const overdueTitle = await page.getByRole('heading', { name: 'الأقساط المتأخرة' }).count();
  expect(clear + overdueTitle).toBe(1);

  await expect(page.locator('main')).not.toContainText('PENDING');

  // The period fields share one row in equal columns (the "more filters"
  // button no longer wraps onto a line of its own).
  const year = await page.locator('label[for="ff-year"]').boundingBox();
  const compare = await page.locator('label[for="ff-compare"]').boundingBox();
  expect(Math.abs(year!.y - compare!.y)).toBeLessThan(2);
  expect(Math.abs(year!.width - compare!.width)).toBeLessThan(4);
});

/**
 * The figures add up: the contract-value split (signed contracts, lifetime)
 * sums to the value, and this month's parts sum to what fell due this month.
 * It mixed the period's collections with lifetime totals ("collected 2.6%,
 * not due 102%").
 */
test('the contract-value split and the month add up', async ({ page }) => {
  await gotoReady(page, '/dashboard/reports/financial');
  // Figures read in ألف / مليون; the exact amount is on data-amount.
  const amount = async (id: string) => {
    const el = page.getByTestId(id);
    if ((await el.count()) === 0) return 0;
    return Number((await el.getAttribute('data-amount')) ?? '0');
  };
  const value = await amount('fin-dist-value');
  const parts = await Promise.all(
    ['paid', 'awaiting', 'overdue', 'notYetDue', 'unscheduled'].map((k) => amount(`fin-dist-${k}`)),
  );
  expect(Math.abs(parts.reduce((a, b) => a + b, 0) - value)).toBeLessThanOrEqual(0.05);

  const month = page.getByTestId('fin-month');
  await expect(month).toBeVisible();
  const due = await amount('fin-month');
  const monthParts = await Promise.all(['paid', 'awaiting', 'overdue', 'upcoming'].map((k) => amount(`fin-month-${k}`)));
  expect(Math.abs(monthParts.reduce((a, b) => a + b, 0) - due)).toBeLessThanOrEqual(0.05);
});
