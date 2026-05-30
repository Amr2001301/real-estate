import { test, expect } from '@playwright/test';
import { loginAsCustomer } from './helpers/auth';

/**
 * P7 — customer-side reservation visibility (`/account/reservations`).
 *
 * The portal previously surfaced no reservation data to CLIENT/CUSTOMER. The
 * backend was extended with a scoped GET /me/reservations and the web added
 *  - a sidebar entry  "الحجوزات"
 *  - a dashboard summary tile + recent-reservations section
 *  - a dedicated /account/reservations page
 *
 * This spec asserts the new page renders for the seeded CUSTOMER (CUSTOMER_1
 * has no reservations by default — empty state is acceptable; the test
 * locks the structural contract: heading + body, never the runtime error
 * overlay).
 */
test.describe('P7 — customer reservations page', () => {
  test('renders for CUSTOMER without crashing; shows cards or the empty state', async ({
    page,
  }) => {
    await loginAsCustomer(page);
    await page.goto('/account/reservations');

    // The Arabic heading is the canonical "page loaded" signal.
    await expect(
      page.getByRole('heading', { name: 'الحجوزات', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // Never the runtime-error overlay text — regardless of whether the
    // customer has reservations.
    await expect(page.getByText(/TypeError/i)).toHaveCount(0);
    await expect(page.getByText(/items\.filter is not a function/i)).toHaveCount(0);

    // Page is structurally complete: either at least one reservation card
    // (whose title reads "حجز رقم …") OR the empty-state copy. What's NOT
    // acceptable is the page rendering only the header (which is what an
    // unhandled paginated/array shape mismatch would produce).
    const hasCard = await page.getByText(/^حجز رقم/).count();
    const hasEmpty = await page.getByText('لا توجد حجوزات بعد').count();
    expect(hasCard + hasEmpty).toBeGreaterThan(0);
  });

  test('sidebar entry "الحجوزات" is visible and navigates to /account/reservations', async ({
    page,
  }) => {
    await loginAsCustomer(page);
    await page.goto('/account');

    // Both the dashboard summary tile and the sidebar link render the text
    // "الحجوزات". Asserting the link in the navigation is the more useful
    // signal — the tile is rendered conditionally on load success.
    const reservationsLink = page.getByRole('link', { name: 'الحجوزات' }).first();
    await expect(reservationsLink).toBeVisible({ timeout: 15_000 });
    await reservationsLink.click();
    await expect(page).toHaveURL(/\/account\/reservations(\?|$)/);
  });
});
