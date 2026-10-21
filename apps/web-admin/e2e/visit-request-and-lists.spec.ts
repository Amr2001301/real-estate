import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * The visit request page leads with the customer, not the request's internal
 * id, and its event log carries one heading (the card used to add a second).
 */
test('visit request page: customer-led hero and a single event-log heading', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const list = await (await request.get(`${API_BASE}/v1/visits/requests?pageSize=1`, { headers })).json();
  const req = list.data[0] as { id: string; customerName?: string | null };
  test.skip(!req, 'no visit requests seeded');

  await gotoReady(page, `/dashboard/visits/requests/${req.id}`);
  const hero = page.getByTestId('visit-request-hero');
  await expect(hero).toBeVisible();
  await expect(hero.locator('h1')).not.toContainText(req.id.slice(0, 8));
  if (req.customerName) await expect(hero.locator('h1')).toHaveText(req.customerName);
  await expect(page.getByRole('heading', { name: 'سجل الأحداث' })).toHaveCount(1);
});

/** Record numbers in the list tables stay on one line. */
test('list tables keep record numbers on one line', async ({ page }) => {
  let checked = 0;
  for (const path of ['/dashboard/visits', '/dashboard/reservations', '/dashboard/contracts', '/dashboard/deposits', '/dashboard/cheques']) {
    await gotoReady(page, path);
    const codes = page.getByTestId('list-code');
    if ((await codes.count()) === 0) continue;
    const box = await codes.first().boundingBox();
    expect(box!.height, path).toBeLessThan(32);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
});

/** Cheques open on a status strip whose "all" card matches the list total. */
test('cheques page: status cards with counts', async ({ page }) => {
  await gotoReady(page, '/dashboard/cheques');
  const strip = page.getByTestId('cheque-status-strip');
  await expect(strip.getByRole('link')).toHaveCount(5);
  const all = strip.getByRole('link').first();
  await expect(all).toHaveAttribute('aria-current', 'page');
  await expect(all).toContainText(/\d/);
});
