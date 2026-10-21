import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * Documents: the list is newest first by default and reads as rows (kind
 * tile, title, category, linked record, uploader); the detail page leads
 * with the file and shows the linked record as a link, not its raw id.
 */
test.use({ storageState: ADMIN_STORAGE });

test('documents list is rows, newest first by default', async ({ page }) => {
  await gotoReady(page, '/dashboard/documents');
  await expect(page.locator('select[name="sortOrder"]')).toHaveValue('desc');
  const rows = page.getByTestId('document-row');
  if ((await rows.count()) === 0) test.skip(true, 'no documents seeded');
  await expect(page.getByTestId('documents').locator('table')).toHaveCount(0);
});

test('document detail leads with the file and hides raw ids', async ({ page }) => {
  await gotoReady(page, '/dashboard/documents');
  const first = page.getByTestId('document-row').first();
  if ((await first.count()) === 0) test.skip(true, 'no documents seeded');
  await first.getByRole('link').first().click();
  await expect(page.getByTestId('document-file')).toBeVisible();
  const details = page.getByTestId('document-details');
  await expect(details).toBeVisible();
  // No UUIDs or MIME types dumped on the page.
  await expect(page.locator('main')).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  await expect(page.locator('main')).not.toContainText('application/');
});
