import { expect, type Page } from '@playwright/test';

/**
 * Fail if the page is showing the not-found shell.
 *
 * Next.js renders not-found.tsx inside the root layout, so the HTTP status
 * can be 200 while the page body is the 404 shell. Any tenant-resolution
 * failure (missing DEV_TENANT_SLUG, bad middleware, etc.) produces this DOM
 * silently — tests that only check a specific element will just report
 * "element not found" with no clue why. This guard makes the real cause
 * visible immediately.
 */
export async function assertNotFoundAbsent(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'لم نتمكن من العثور على هذه الصفحة', level: 1 }),
    'page is showing the not-found shell — tenant resolution likely failed',
  ).toHaveCount(0);
}
