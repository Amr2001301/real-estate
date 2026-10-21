import { test, expect } from '@playwright/test';
import { SALES_STORAGE, MANAGER_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * The sales and manager homes, redesigned as a cockpit: the navy command band
 * with the month's target, the lead board (newest leads per open stage) and
 * the agenda; the manager adds the team ranking and what needs attention.
 */
test.describe('sales desk', () => {
  test.use({ storageState: SALES_STORAGE });
  test('command band, four tiles, lead board with the four open stages', async ({ page }) => {
    await gotoReady(page, '/dashboard');
    await expect(page.getByTestId('command-band')).toBeVisible();
    await expect(page.getByTestId('stat-tile')).toHaveCount(4);
    const board = page.getByTestId('lead-board');
    await expect(board).toBeVisible();
    for (const stage of ['جديد', 'مهتم', 'زيارة', 'تفاوض']) await expect(board).toContainText(stage);
  });
});

test.describe('manager command center', () => {
  test.use({ storageState: MANAGER_STORAGE });
  test('team ranking, attention panel and the team lead board', async ({ page }) => {
    await gotoReady(page, '/dashboard');
    await expect(page.getByTestId('command-band')).toBeVisible();
    await expect(page.getByTestId('leaderboard')).toBeVisible();
    await expect(page.getByTestId('attention')).toBeVisible();
    await expect(page.getByTestId('lead-board')).toBeVisible();
  });
});
