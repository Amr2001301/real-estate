import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * Content management: three tabs (articles, pages, banners), one shown at a
 * time; the article form writes one language at a time and jumps to the
 * language whose required field is still empty.
 */
test.use({ storageState: ADMIN_STORAGE });

test('content page shows one section at a time behind tabs', async ({ page }) => {
  await gotoReady(page, '/dashboard/cms');
  await expect(page.getByTestId('cms-tabs').getByRole('link')).toHaveCount(3);
  await expect(page.getByTestId('cms-articles')).toBeVisible();
  await expect(page.getByTestId('cms-pages')).toHaveCount(0);
  await page.getByTestId('cms-tabs').getByRole('link').nth(1).click();
  await expect(page).toHaveURL(/tab=pages/);
  await expect(page.getByTestId('cms-pages')).toBeVisible();
  await expect(page.getByTestId('cms-articles')).toHaveCount(0);
});

test('article form switches to the language with a missing required title', async ({ page }) => {
  await gotoReady(page, '/dashboard/cms/articles/new');
  await page.locator('input[name="slug"]').fill(`e2e-${Date.now()}`);
  await page.locator('input[name="ar_title"]').fill('عنوان تجريبي');
  // English is hidden and empty: submitting must bring its tab forward.
  await page.getByRole('button', { name: 'إنشاء المقال' }).click();
  await expect(page.getByRole('tab', { name: 'English' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('input[name="en_title"]')).toBeVisible();
});
