import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * P5 — regression for the admin `/dashboard/notifications` page. The page
 * was crashing with `items.filter is not a function` because it cast the
 * paginated `{ data, meta }` response from `/me/notifications` as a plain
 * array. Asserting the page renders without surfacing the runtime-error
 * overlay locks the fix in.
 */
test.describe('P5 — admin notifications inbox', () => {
  test('renders the admin inbox without crashing on the paginated response', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/notifications');

    await expect(
      page.getByRole('heading', { name: 'الإشعارات' }),
    ).toBeVisible({ timeout: 15_000 });

    // The fix point: `items.filter is not a function` must never reach the UI.
    await expect(
      page.getByText(/items\.filter is not a function/i),
    ).toHaveCount(0);
    // Next.js renders its dev runtime-error overlay at the root when an
    // unhandled exception escapes a server component — assert it stays away.
    await expect(page.getByText(/Unhandled Runtime Error/i)).toHaveCount(0);
  });
});
