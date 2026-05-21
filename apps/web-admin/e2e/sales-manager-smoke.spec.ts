import { test, expect } from '@playwright/test';
import { loginAsManager } from './helpers/auth';
import {
  assertRouteLoads,
  assertNavLinksHidden,
  ADMIN_ONLY_NAV_LABELS,
  type RouteCheck,
} from './helpers/assert';

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
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
  });

  test('lands on the manager dashboard home', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login(\?|$)/);
    await expect(page.getByText('لوحة مدير المبيعات').first()).toBeVisible();
    // Neither the SALES home nor the admin home.
    await expect(page.getByText('مرحباً بك في المجلس الرقمي')).toHaveCount(0);

    // Either the team table (seeded team) or the no-team empty state is shown.
    const teamTable = page.getByText('أداء المندوبين');
    const emptyState = page.getByText('لم يتم ربط أي مندوب مبيعات بهذا المدير بعد');
    await expect(teamTable.or(emptyState).first()).toBeVisible();
  });

  test('can load every manager route without auth redirect or error', async ({ page }) => {
    for (const route of MANAGER_ROUTES) {
      await assertRouteLoads(page, route);
    }
  });

  test('SALES self-view is not in the manager nav', async ({ page }) => {
    await page.goto('/dashboard');
    await assertNavLinksHidden(page, ['مستحقاتي وأهدافي']);
  });

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
