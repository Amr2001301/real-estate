import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';
const SLUG = process.env.E2E_COMPANY_SLUG ?? 'default';

/**
 * FG-04 — staff move a customer inquiry OPEN → RESPONDED → CLOSED from
 * /dashboard/requests. There was no write path, so the queue never drained;
 * the page's status filter was also ignored by the API.
 *
 * The inquiry is created through the public endpoint (as a website visitor
 * would), so each run has a fresh OPEN one.
 */
test('an inquiry is marked responded, then closed, and the status filter follows it', async ({ page, request }) => {
  const message = `[e2e] FG-04 inquiry ${Date.now()}`;
  const created = await request.post(`${API_BASE}/v1/public/info-request`, {
    headers: { 'X-Tenant-Slug': SLUG },
    data: { message, name: 'FG04 Visitor', phone: '+201000000404' },
  });
  expect(created.status()).toBe(201);

  /** The inquiry's row on the list filtered to `status`. */
  const rowIn = async (status: string) => {
    await page.goto(`/dashboard/requests?status=${status}`, { waitUntil: 'networkidle' });
    return page.locator('tr', { hasText: message });
  };

  let row = await rowIn('OPEN');
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'تم الرد' }).click();
  // The OPEN list no longer holds it once the action re-renders the page.
  await expect(row).toHaveCount(0);

  row = await rowIn('RESPONDED');
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('button', { name: 'تم الرد' })).toHaveCount(0);
  await row.getByRole('button', { name: 'إغلاق' }).click();
  await expect(row).toHaveCount(0);

  row = await rowIn('CLOSED');
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('button')).toHaveCount(0);
});
