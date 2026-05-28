import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';

// Phase 7E — reuse the admin storage state instead of logging in per-test.
test.use({ storageState: ADMIN_STORAGE });

/**
 * Flow B — admin side of the lead journey proof.
 *
 * Logs in as admin and asserts the lead created by the paired web-public
 * spec (`apps/web-public/e2e/flow-b-public-info-request.spec.ts`) appears
 * in `/dashboard/leads`. Cross-spec coordination is via shared env:
 * `E2E_FLOW_B_NAME` must match what the public spec submitted.
 *
 * Run order: web-public spec first (creates the lead), then this one.
 * The full sequence is documented in `docs/system-qa-strategy.md` §0.2.
 *
 * Requires: API running, admin Web running, the lead exists in the DB
 * (i.e. the public spec actually succeeded).
 */
const FORM_NAME = process.env.E2E_FLOW_B_NAME;

test.describe('Flow B — admin /dashboard/leads shows the lead the public form created', () => {
  test.skip(
    !FORM_NAME,
    'Skipped: E2E_FLOW_B_NAME env not set. Run with the paired public spec — see docs/system-qa-strategy.md §0.2.',
  );

  test('the lead with the shared name is visible in the leads list', async ({ page }) => {
    await page.goto('/dashboard/leads');
    // Newest leads appear in the pipeline / list — assert the shared name renders.
    await expect(
      page.getByText(FORM_NAME!).first(),
      'lead from the public form should appear in /dashboard/leads',
    ).toBeVisible({ timeout: 15_000 });
  });
});
