import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * Printing & documents: the paper, the signature and stamp, and the wording.
 * The wording editor fills its fields in the preview, amounts in words included.
 */
test('the printing page shows the paper, the seal and the wording', async ({ page }) => {
  await gotoReady(page, '/dashboard/company/print');
  await expect(page.getByTestId('print-paper-settings')).toBeVisible();
  await expect(page.getByTestId('print-seal-settings')).toBeVisible();
  await expect(page.getByTestId('document-templates')).toBeVisible();
  await expect(page.getByTestId('print-preview')).toBeVisible();

  // Choosing the company's own paper asks for its images and margins.
  await page.getByTestId('paper-mode-HEADER_FOOTER').click();
  await expect(page.getByTestId('paper-marginTopMm')).toBeVisible();
});

test('the wording editor fills the preview from a ready wording', async ({ page }) => {
  await gotoReady(page, '/dashboard/company/print/templates/new');
  await page.getByTestId('template-starter').first().click();
  const preview = page.getByTestId('template-preview');
  // The fields are filled in — no raw {{placeholder}} reaches the page.
  await expect(preview).not.toContainText('{{');
  await expect(preview).toContainText(/فقط .* لا غير|Only /);
  await expect(page.getByTestId('template-name')).not.toHaveValue('');
});
