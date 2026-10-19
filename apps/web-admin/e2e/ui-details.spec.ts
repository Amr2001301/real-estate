import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE, MANAGER_STORAGE, SALES_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

/**
 * Small findings from the manual walk-through:
 * - F5: the per-user permissions page had no link from the Users list.
 * - F6: the login page showed made-up figures («+500 وحدة عقارية»).
 * - F14: a manager choosing «غير مسند» on a new lead got it assigned to
 *   themself; only an admin can leave a lead in the pool.
 * - F15: a rep could open «عميل جديد», whose save the API always refuses,
 *   and the phone example was Saudi.
 */

test.describe('admin', () => {
  test.use({ storageState: ADMIN_STORAGE });

  test('F5: each user row links to its permissions page', async ({ page }) => {
    await gotoReady(page, '/dashboard/users');
    const link = page.locator('tbody a[href$="/permissions"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/dashboard\/users\/[0-9a-f-]{36}\/permissions$/);
  });

  test('F14: the admin can still leave a new lead unassigned', async ({ page }) => {
    await gotoReady(page, '/dashboard/leads/new');
    await expect(page.locator('select[name="assignedSalesId"] option[value=""]')).toHaveCount(1);
  });

  test('F15: the new client form suggests an Egyptian number', async ({ page }) => {
    await gotoReady(page, '/dashboard/clients/new');
    await expect(page.locator('input[name="phone"]')).toHaveAttribute('placeholder', /^\+20 /);
  });
});

test.describe('signed out', () => {
  test('F6: the login page shows no made-up figures', async ({ page }) => {
    await gotoReady(page, '/login');
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByText('وحدة عقارية')).toHaveCount(0);
    await expect(page.getByText('مشروع نشط')).toHaveCount(0);
  });
});

test.describe('manager', () => {
  test.use({ storageState: MANAGER_STORAGE });

  test('F14: no «غير مسند» option — the lead defaults to the manager', async ({ page }) => {
    await gotoReady(page, '/dashboard/leads/new');
    const select = page.locator('select[name="assignedSalesId"]');
    await expect(select).toBeVisible();
    await expect(select.locator('option[value=""]')).toHaveCount(0);
    expect(await select.inputValue()).not.toBe('');
  });
});

test.describe('sales rep', () => {
  test.use({ storageState: SALES_STORAGE });

  test('F15: «عميل جديد» sends the rep to the lead form', async ({ page }) => {
    await gotoReady(page, '/dashboard/clients/new');
    await expect(page).toHaveURL(/\/dashboard\/leads\/new$/);
  });
});
