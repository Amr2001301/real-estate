import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * Reservations and visit requests: a row is an eye and a «⋯» — approve, reject,
 * schedule and cancel live in the menu, and a row still waiting for a decision
 * is marked.
 */
test.use({ storageState: ADMIN_STORAGE });

test('reservations: the decisions are in the menu, not on the row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoReady(page, '/dashboard/reservations');
  const waiting = page.locator('tr[data-waiting="true"]');
  if ((await waiting.count()) === 0) test.skip(true, 'no pending reservation seeded');
  const row = waiting.first();
  // No inline approve / reject buttons.
  await expect(row.getByRole('button', { name: 'موافقة' })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'رفض الحجز' })).toHaveCount(0);
  await row.getByTestId('row-menu').click();
  await expect(page.getByRole('menuitem', { name: 'موافقة' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'رفض الحجز' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'إلغاء' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(0);
});

test('visit requests: schedule is in the menu, and the menu is never clipped', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoReady(page, '/dashboard/visits?tab=requests');
  const waiting = page.locator('tr[data-waiting="true"]');
  if ((await waiting.count()) === 0) test.skip(true, 'no open visit request seeded');
  const row = waiting.first();
  await expect(row.getByRole('button', { name: 'جدولة' })).toHaveCount(0);
  await row.getByTestId('row-menu').click();
  await expect(page.getByRole('menuitem', { name: 'جدولة' })).toBeVisible();
  await page.keyboard.press('Escape');

  // The last row's menu opens inside the window, whichever way it opens.
  const menus = page.locator('main table.list-table tbody tr').last().getByTestId('row-menu');
  if ((await menus.count()) > 0) {
    await menus.scrollIntoViewIfNeeded();
    await menus.click();
    const box = await page.getByRole('menu').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    expect(box!.x).toBeGreaterThanOrEqual(0);
  }
});
