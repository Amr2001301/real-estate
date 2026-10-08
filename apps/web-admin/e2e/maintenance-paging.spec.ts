import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';

test.use({ storageState: ADMIN_STORAGE });

/**
 * FG-23 — /dashboard/maintenance is paged (20 per page). It used to fetch one
 * `pageSize=100` list with no pager, so request 101 was never shown.
 *
 * Seed: prisma:seed:e2e — the Customer1 request plus 24 "[e2e] paging
 * request NN" rows dated 2025 (newest first, so they fill page 1 after the
 * Customer1 request and spill onto page 2).
 */
test('the maintenance list pages past the first 20 requests', async ({ page }) => {
  test.slow(); // same heavy page as flow-cef (reports + options)
  await page.goto('/dashboard/maintenance', { waitUntil: 'networkidle' });
  await expect(page.getByText('[e2e] Customer1 maintenance request — leaky faucet').first()).toBeVisible();
  // The oldest seeded request is beyond the first page.
  await expect(page.getByText('[e2e] paging request 01')).toHaveCount(0);

  await page.getByRole('link', { name: 'التالي' }).click();
  await expect(page).toHaveURL(/[?&]page=2/);
  await expect(page.getByText('[e2e] paging request 01')).toBeVisible();
  await expect(page.getByText('[e2e] Customer1 maintenance request — leaky faucet')).toHaveCount(0);
});

test('filters are kept when paging', async ({ page }) => {
  test.slow();
  await page.goto('/dashboard/maintenance?status=OPEN&page=2', { waitUntil: 'networkidle' });
  const prev = page.getByRole('link', { name: 'السابق' });
  await expect(prev).toHaveAttribute('href', /status=OPEN/);
});
