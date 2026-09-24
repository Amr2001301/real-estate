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

    // The account layout renders a PageHero whose h1 is the welcome message.
    // Waiting for it proves the server component rendered without crashing —
    // i.e. extractPaginatedData() on the /me/notifications response did not
    // throw before the component reached the JSX return.
    await expect(
      page.getByRole('heading', { name: /مرحبًا/ }),
    ).toBeVisible({ timeout: 15_000 });

    // The page must not surface the runtime-error overlay regardless of
    // whether the customer has notifications.
    await expect(page.getByText(/notifications\.filter is not a function/i)).toHaveCount(0);
    await expect(page.getByText(/items\.filter is not a function/i)).toHaveCount(0);
    await expect(page.getByText(/TypeError/i)).toHaveCount(0);

    // The "إجراءات سريعة" (quick-actions) section is gated to CUSTOMER role
    // and renders after all notifications data is processed. Its presence
    // proves the extractPaginatedData() / .slice() calls completed without
    // throwing — the original P10 regression path.
    await expect(page.getByText('إجراءات سريعة')).toBeVisible({ timeout: 10_000 });

    // Customer-specific KPI tile — proves the CUSTOMER data branch rendered.
    await expect(page.getByText('إجمالي المدفوعات')).toBeVisible();
  });
});
