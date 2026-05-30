import { test, expect } from '@playwright/test';
import { loginAsCustomer } from './helpers/auth';

/**
 * P10 — regression for the `/account` dashboard that crashed with
 * `notifications.filter is not a function` after the backend switched
 * `/me/notifications` to a paginated `{ data, meta }` shape. P5 fixed only
 * the dedicated `/account/notifications` page; the dashboard summary tile +
 * recent-notifications section still treated the response as a flat array.
 *
 * This spec asserts that the dashboard renders for the seeded CUSTOMER
 * without surfacing the runtime-error overlay, and that the post-purchase
 * customer section (which only renders for CUSTOMER role) is present —
 * proving the code path that consumes the notifications response was
 * exercised.
 */
test.describe('P10 — customer account dashboard renders with paginated notifications', () => {
  test('dashboard does not crash on the paginated /me/notifications response', async ({
    page,
  }) => {
    await loginAsCustomer(page);
    await page.goto('/account');

    // Dashboard heading: "نظرة عامة".
    await expect(
      page.getByRole('heading', { name: 'نظرة عامة', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // The page must not surface the runtime-error overlay regardless of
    // whether the customer has notifications.
    await expect(page.getByText(/notifications\.filter is not a function/i)).toHaveCount(0);
    await expect(page.getByText(/items\.filter is not a function/i)).toHaveCount(0);
    await expect(page.getByText(/TypeError/i)).toHaveCount(0);

    // The customer post-purchase section is gated to CUSTOMER role and is
    // where the notifications summary tile + recent-notifications block
    // live. Asserting the section heading is visible proves that branch
    // executed — i.e. the .filter() / .slice() calls on the normalised
    // notifications array did not throw.
    await expect(
      page.getByRole('heading', { name: 'خدمات ما بعد الشراء', level: 2 }),
    ).toBeVisible({ timeout: 10_000 });

    // The unread-notifications summary tile.
    await expect(page.getByText('إشعارات غير مقروءة')).toBeVisible();
  });
});
