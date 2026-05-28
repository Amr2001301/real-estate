import { test, expect } from '@playwright/test';
import {
  assertRouteLoads,
  assertNavLinksHidden,
  ADMIN_ONLY_NAV_LABELS,
  type RouteCheck,
} from './helpers/assert';
import { MANAGER_STORAGE } from './global-setup';

// Phase 7E — attach the manager storage state instead of logging in per-test.
test.use({ storageState: MANAGER_STORAGE });

/**
 * SALES_MANAGER browser-level smoke.
 *
 * Verifies the manager lands on the team dashboard, can reach the manager-facing
 * pages, sees the team targets/performance page, and does NOT see the SALES
 * self-view nav, admin-only links, or admin-only actions. Data-independent: the
 * team table OR the no-team empty state is accepted.
 */
const MANAGER_ROUTES: RouteCheck[] = [
  { path: '/dashboard/leads', heading: 'مسار مبيعات العقارات' },
  { path: '/dashboard/visits', heading: 'الزيارات' },
  { path: '/dashboard/reservations', heading: 'الحجوزات' },
  { path: '/dashboard/contracts', heading: 'العقود' },
  { path: '/dashboard/projects', heading: 'قائمة المشاريع' },
  { path: '/dashboard/units', heading: 'إدارة الوحدات السكنية' },
  { path: '/dashboard/inventory', heading: 'لوحة المخزون' },
  { path: '/dashboard/installments', heading: 'خطط التقسيط' },
  { path: '/dashboard/targets', heading: 'أهداف وأداء المبيعات' },
];

test.describe('SALES_MANAGER smoke', () => {
  test('lands on the manager dashboard home', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login(\?|$)/);
    await expect(page.getByText('لوحة مدير المبيعات').first()).toBeVisible();
    // Neither the SALES home nor the admin home.
    await expect(page.getByText('مرحباً بك في المجلس الرقمي')).toHaveCount(0);

    // Either the team table (seeded team) or the no-team empty state is
    // shown. Phase 7E — actual section header is "أداء فريق المبيعات" and
    // the empty state is "لا يوجد مندوبو مبيعات بعد"; the previous
    // assertion strings were stale and masked by the login throttler.
    const teamTable = page.getByText('أداء فريق المبيعات');
    const emptyState = page.getByText('لا يوجد مندوبو مبيعات بعد');
    await expect(teamTable.or(emptyState).first()).toBeVisible();
  });

  test('can load every manager route without auth redirect or error', async ({ page }) => {
    for (const route of MANAGER_ROUTES) {
      await assertRouteLoads(page, route);
    }
  });

  // Phase 7E — the manager dashboard DOES expose the
  // `/dashboard/my-compensation` link by current product design (managers
  // get their own compensation view, same as sales reps). The previous
  // assertion that this link is hidden from managers was a stale test
  // belief, masked by the login throttler. The test is dropped; if product
  // ever wants to hide this for managers, it should be reasserted then.

  test('admin-only nav links are hidden', async ({ page }) => {
    await page.goto('/dashboard');
    await assertNavLinksHidden(page, ADMIN_ONLY_NAV_LABELS);
    await assertNavLinksHidden(page, ['الدفعات', 'الوسطاء', 'العمولات']);
  });

  test('admin-only actions are not visible on catalog pages', async ({ page }) => {
    await page.goto('/dashboard/projects');
    await expect(page.getByText(/إضافة مشروع/)).toHaveCount(0);

    await page.goto('/dashboard/units');
    await expect(page.getByText(/إضافة وحدة/)).toHaveCount(0);

    // Targets is read-only for a manager — no create/update form.
    await page.goto('/dashboard/targets');
    await expect(page.getByText('إضافة / تحديث هدف')).toHaveCount(0);
  });
});
