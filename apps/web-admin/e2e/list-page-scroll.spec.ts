import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * The list pages (reservations, contracts, visits) scroll as a whole: the
 * table is never a box with its own hidden up-and-down scroll, and the pager
 * comes after the last row, reached by scrolling the page.
 */
test.use({ storageState: ADMIN_STORAGE });

for (const path of ['/dashboard/reservations', '/dashboard/contracts', '/dashboard/visits']) {
  test(`${path}: no up-and-down scroll inside the table; pager after the rows`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoReady(page, path);
    const table = page.locator('main table.list-table').first();
    if ((await table.count()) === 0) test.skip(true, 'no rows seeded');

    // The box around the table has no rows hidden below its edge: it is as tall as the table.
    const hidden = await table.evaluate((t) => {
      const w = t.parentElement!;
      return w.scrollHeight - w.clientHeight;
    });
    expect(hidden).toBeLessThanOrEqual(1);

    // The card's last piece (the pager, when there is one) sits below the last row.
    const pagerBelow = await table.evaluate((t) => {
      const card = t.closest('section')!;
      const last = card.lastElementChild as HTMLElement;
      if (last.contains(t)) return true; // no pager on this page
      return last.getBoundingClientRect().top >= t.getBoundingClientRect().bottom - 1;
    });
    expect(pagerBelow).toBe(true);

    // Scrolling the page to the end brings the last row (and the pager under it) into view.
    await page.evaluate(() => {
      const m = document.getElementById('main-scroll')!;
      m.scrollTop = m.scrollHeight;
    });
    await expect(table.locator('tbody tr').last()).toBeInViewport();
  });
}

for (const path of ['/dashboard/reservations', '/dashboard/broker-contracts']) {
  test(`${path}: a table wider than its card keeps the actions column in view`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoReady(page, path);
    const table = page.locator('main table.list-table').first();
    if ((await table.count()) === 0) test.skip(true, 'no rows seeded');
    const edge = await table.evaluate((t) => {
      const w = t.parentElement!.getBoundingClientRect();
      const cell = t.querySelector('tbody tr td:last-child')!.getBoundingClientRect();
      return { inside: cell.left >= w.left - 1 && cell.right <= w.right + 1 };
    });
    expect(edge.inside).toBe(true);
  });
}
