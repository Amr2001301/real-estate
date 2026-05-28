import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';

// Phase 7E — reuse the admin storage state instead of logging in per-test.
test.use({ storageState: ADMIN_STORAGE });

/**
 * Flow A — Catalog sync proof (admin side).
 *
 * Asserts the admin dashboard's project list contains the project that
 * `seedPublicDemo()` produces — the same project the public catalog and
 * the backend e2e suite read.
 *
 * Requires:
 *   - the API running (default :4000), seeded via
 *     `pnpm --filter @rep/api prisma:seed:e2e` (which forces
 *     SEED_PUBLIC_DEMO=true);
 *   - the web-admin server running on E2E_BASE_URL (default :3001).
 *
 * Unlike `dashboard-smoke.spec.ts`, this assertion is data-dependent —
 * by design. The Phase 7A proof is: backend has the row, public site
 * shows it, admin site shows it.
 */
const SEEDED_PROJECT_NAME_AR = 'نايل كريست ريزيدنس';

test.describe('Flow A — admin catalog sync (requires seeded backend)', () => {
  test('admin /dashboard/projects lists the seeded project', async ({ page }) => {
    await page.goto('/dashboard/projects');
    await expect(
      page.getByText(SEEDED_PROJECT_NAME_AR).first(),
      'seeded project should be visible — did you run prisma:seed:e2e against the API\'s DB?',
    ).toBeVisible();
  });
});
