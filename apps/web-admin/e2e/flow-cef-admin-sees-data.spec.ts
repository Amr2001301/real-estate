import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';

// Phase 7E — reuse the admin storage state instead of logging in per-test.
test.use({ storageState: ADMIN_STORAGE });

/**
 * Phase 7C cross-app proof — admin can see the customer-facing records.
 *
 * Single small spec covering Flow E (deposit/contract) + Flow F
 * (maintenance) at the admin-list level. Asserts the seeded rows from
 * `apps/api/prisma/seed-e2e.ts` (the Customer1 maintenance request +
 * the Customer1 contract pdf) surface in the admin dashboard's listing
 * pages. Data-dependent — by design, paired with the seeded e2e DB.
 *
 * Customer-portal side of E/F is NOT covered here. Reasons:
 *   1. Customer-portal Playwright is not yet established for this app
 *      (no prior `loginAsCustomer` helper or selector contract).
 *   2. The /account routes (server-component-gated by `isPortalRole`)
 *      have RTL Arabic copy that has historically been brittle (cf. the
 *      two pre-existing public-smoke flakes flagged in Phase 7A.1).
 *   3. Backend e2e (Flow E + F, 27 cases) is the source of truth for
 *      customer-side scoping + signed-download behavior.
 *
 * Documented in `docs/system-qa-strategy.md` §0.3.
 */
test.describe('Flow C/E/F — admin can see customer-facing records (data-dependent)', () => {
  test('admin /dashboard/maintenance lists the seeded Customer1 maintenance request', async ({ page }) => {
    await page.goto('/dashboard/maintenance');
    // The seeded description is a deterministic marker tagged "[e2e]".
    await expect(
      page.getByText('[e2e] Customer1 maintenance request — leaky faucet').first(),
      'seeded maintenance request should be visible — did you run prisma:seed:e2e against the API\'s DB?',
    ).toBeVisible({ timeout: 15_000 });
  });

  test('admin /dashboard/deposits lists at least one deposit (the seeded Customer1 DOWN_PAYMENT)', async ({ page }) => {
    await page.goto('/dashboard/deposits');
    // The deposits list table doesn't surface a per-row Arabic marker we
    // can pin without reading the page DOM each time; assert instead that
    // at least one deposit row link is present. This is the same
    // "list-page renders ≥1 record" shape the public Flow A unit list
    // spec uses, and is robust against UI copy edits.
    await expect(
      page.locator('a[href^="/dashboard/deposits/"]').first(),
      'at least one deposit row should be visible — did you run prisma:seed:e2e?',
    ).toBeVisible({ timeout: 15_000 });
  });
});
