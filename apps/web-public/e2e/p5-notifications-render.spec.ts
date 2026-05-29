import { test, expect } from '@playwright/test';
import { loginAsCustomer } from './helpers/auth';

/**
 * P5 — regression for the `/account/notifications` page that previously
 * crashed with `items.filter is not a function` after the backend switched
 * `/me/notifications` to a paginated `{ data, meta }` shape. The page was
 * also unreachable to CLIENT (lived inside the (customer) route group); the
 * test asserts the page renders for the seeded CUSTOMER and contains either
 * a card or the empty state — never the runtime-error overlay.
 */
test.describe('P5 — customer notifications page', () => {
  test('renders for CUSTOMER without crashing on the paginated API response', async ({
    page,
  }) => {
    await loginAsCustomer(page);
    await page.goto('/account/notifications');

    // The Arabic heading is the canonical "page loaded" signal.
    await expect(
      page.getByRole('heading', { name: 'الإشعارات', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // The page should not surface the runtime-error overlay text, regardless
    // of whether the customer has notifications. The empty state IS a valid
    // terminal state.
    await expect(page.getByText(/items\.filter is not a function/i)).toHaveCount(0);
    await expect(page.getByText(/TypeError/i)).toHaveCount(0);

    // The page is structurally complete: either at least one notification
    // (cards render their backend-resolved title text — visit_scheduled →
    // "تم جدولة زيارتك") OR the empty-state copy. Both are acceptable;
    // what's NOT acceptable is the page rendering only the header (which is
    // what the crash produced before the fix).
    const hasCardTitle =
      (await page.getByText(/تم جدولة زيارتك/).count()) +
      (await page.getByText(/إشعار جديد/).count());
    const hasEmpty = await page.getByText('لا توجد إشعارات بعد').count();
    expect(hasCardTitle + hasEmpty).toBeGreaterThan(0);
  });
});
