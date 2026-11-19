import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE, BROKER_STORAGE, SALES_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * The figure cards over the list pages: a card that opens a list opens exactly
 * the rows its number counts, is marked as the one on, and a second click goes
 * back to the whole list.
 */

/** How many rows the list below holds: the pager's total, else the rows on the page. */
async function listTotal(page: Page): Promise<number> {
  const pager = page.locator('[data-testid="list-pager"]');
  if (await pager.count()) return Number(await pager.first().getAttribute('data-total'));
  return page.locator('main table.list-table tbody tr').count();
}

async function checkCards(page: Page, path: string) {
  await gotoReady(page, path);
  const cards = page.locator('[data-testid="figure"]');
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  let links = 0;
  for (let i = 0; i < n; i++) {
    await gotoReady(page, path);
    const card = cards.nth(i);
    const label = (await card.locator('dt').innerText()).trim();
    // A number with no list of its own (the portal's «قيمة الصفحة») is not a link.
    if ((await card.evaluate((el) => el.tagName)) !== 'A') continue;
    const value = Number((await card.locator('dd.num').innerText()).replace(/[^\d]/g, ''));
    links++;
    const href = await card.getAttribute('href');
    await gotoReady(page, href!);
    const on = page.locator('[data-testid="figure"][data-active="true"]');
    await expect(on, `${path} «${label}» is marked as on`).toHaveCount(1);
    await expect(on.locator('dt')).toHaveText(label);
    expect(await listTotal(page), `${path} «${label}»: the number is the rows it opens`).toBe(value);
    // The card that is on leads back to the whole list.
    expect(new URL((await on.getAttribute('href'))!, 'http://x').search).toBe('');
  }
  expect(links).toBeGreaterThan(0);
}

test.describe('admin', () => {
  test.use({ storageState: ADMIN_STORAGE });
  for (const path of ['/dashboard/reservations', '/dashboard/contracts', '/dashboard/visits']) {
    test(`${path}: each card opens the rows it counts`, async ({ page }) => {
      await checkCards(page, path);
    });
  }

  test('a search on top of a card turns the card off', async ({ page }) => {
    await gotoReady(page, '/dashboard/reservations?status=PENDING&q=zz-no-such-client');
    await expect(page.locator('[data-testid="figure"][data-active="true"]')).toHaveCount(0);
  });
});

test.describe('sales rep', () => {
  test.use({ storageState: SALES_STORAGE });
  // A rep sees their own reservations and visits; the cards count the same.
  for (const path of ['/dashboard/reservations', '/dashboard/visits']) {
    test(`${path}: each card opens the rows it counts`, async ({ page }) => {
      await checkCards(page, path);
    });
  }
});

test.describe('broker portal', () => {
  test.use({ storageState: BROKER_STORAGE });
  for (const path of ['/portal/reservations', '/portal/contracts', '/portal/visits']) {
    test(`${path}: each card opens the rows it counts`, async ({ page }) => {
      await checkCards(page, path);
    });
  }
});
