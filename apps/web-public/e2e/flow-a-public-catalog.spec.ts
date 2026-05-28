import { test, expect } from '@playwright/test';

/**
 * Flow A — Catalog sync proof (public side).
 *
 * Asserts the public catalog shows the project the backend seeds via
 * `seedPublicDemo()` (and which the backend e2e suite also reads).
 *
 * Requires: the API running on its usual port (default :4000) AND a
 * database seeded by either:
 *   - `pnpm --filter @rep/api prisma:seed` with SEED_PUBLIC_DEMO=true, OR
 *   - `pnpm --filter @rep/api prisma:seed:e2e` (which forces the above).
 *
 * Unlike `public-smoke.spec.ts`, this one is NOT resilient to a missing
 * API / empty database — that's the point. If you're running it without
 * the seeded backend it will (correctly) fail with a clear message about
 * the missing project card.
 *
 * The asserted Arabic name comes from the first project produced by
 * `seedPublicDemo()` in `apps/api/prisma/seed.ts`. If the demo dataset
 * is renamed, update this assertion in the same commit.
 */
const SEEDED_PROJECT_NAME_AR = 'نايل كريست ريزيدنس';

test.describe('Flow A — public catalog sync (requires seeded backend)', () => {
  test('public /projects shows the seeded project', async ({ page }) => {
    const res = await page.goto('/projects');
    expect(res?.status()).toBe(200);
    await expect(
      page.getByText(SEEDED_PROJECT_NAME_AR).first(),
      'seeded project should be visible — did you run prisma:seed:e2e against the API\'s DB?',
    ).toBeVisible();
  });

  test('public /units list page loads with at least one unit card', async ({ page }) => {
    const res = await page.goto('/units');
    expect(res?.status()).toBe(200);
    // We don't pin a specific unit's name (units have generic numbers in the
    // seed). Instead we assert the page rendered its hero AND that at least
    // one unit-card-shaped element is present.
    await expect(page.getByRole('heading', { name: 'وحدات فاخرة جاهزة لاختيارك' })).toBeVisible();
    await expect(
      page.locator('a[href^="/units/"]').first(),
      'expected at least one unit card linking to /units/:id; is the catalog seeded?',
    ).toBeVisible();
  });
});
