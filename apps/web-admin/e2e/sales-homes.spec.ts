import { test, expect } from '@playwright/test';
import { SALES_STORAGE, MANAGER_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * The sales and manager homes as a day planner: a quiet header with the day
 * and the month's target, one row of six figures, the week's agenda around
 * the selected day (`?day=`), the day's tasks and the open leads by stage.
 * The old lead board and booking cards are gone.
 */
test.describe('sales desk', () => {
  test.use({ storageState: SALES_STORAGE });

  test('day header, six figures, the week strip and the open leads split', async ({ page }) => {
    await gotoReady(page, '/dashboard');
    await expect(page.getByTestId('day-header')).toBeVisible();
    await expect(page.getByTestId('figure')).toHaveCount(6);
    const strip = page.getByTestId('day-strip');
    await expect(strip.getByRole('link')).toHaveCount(7);
    // Today is the selected day when none is asked for.
    await expect(strip.getByRole('link').first()).toHaveAttribute('aria-current', 'date');
    const pipeline = page.getByTestId('pipeline');
    for (const stage of ['جديد', 'مهتم', 'زيارة', 'تفاوض']) await expect(pipeline).toContainText(stage);
    await expect(page.getByTestId('lead-board')).toHaveCount(0);
    await expect(page.getByTestId('expiry-cards')).toHaveCount(0);
  });

  test('picking a day in the strip opens that day', async ({ page }) => {
    await gotoReady(page, '/dashboard');
    const third = page.getByTestId('day-strip').getByRole('link').nth(2);
    const href = await third.getAttribute('href');
    expect(href).toMatch(/\?day=\d{4}-\d{2}-\d{2}$/);
    await third.click();
    await expect(page).toHaveURL(/\?day=\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByTestId('day-strip').getByRole('link').nth(2)).toHaveAttribute('aria-current', 'date');
    await expect(page.getByTestId('day-strip').getByRole('link').first()).not.toHaveAttribute('aria-current', 'date');
    await expect(page.getByTestId('timeline').or(page.getByTestId('timeline-empty'))).toBeVisible();
  });

  test('a day outside the week falls back to today', async ({ page }) => {
    await gotoReady(page, '/dashboard?day=1999-01-01');
    await expect(page.getByTestId('day-strip').getByRole('link').first()).toHaveAttribute('aria-current', 'date');
  });
});

test.describe('manager day', () => {
  test.use({ storageState: MANAGER_STORAGE });

  test('team agenda, attention, team ranking and the open leads split', async ({ page }) => {
    await gotoReady(page, '/dashboard');
    await expect(page.getByTestId('day-header')).toBeVisible();
    await expect(page.getByTestId('figure')).toHaveCount(6);
    await expect(page.getByTestId('day-strip').getByRole('link')).toHaveCount(7);
    await expect(page.getByTestId('attention')).toBeVisible();
    await expect(page.getByTestId('leaderboard')).toBeVisible();
    await expect(page.getByTestId('pipeline')).toBeVisible();
    await expect(page.getByTestId('lead-board')).toHaveCount(0);
  });
});
