import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

/**
 * Users: four summary cards, then one row per user — the sales manager is
 * shown by name and changed on demand, not a picker on every row.
 */
test('the users page summarises the team and changes a manager on demand', async ({ page }) => {
  await gotoReady(page, '/dashboard/users');
  for (const id of ['users-total', 'users-active', 'users-inactive', 'users-admins']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  // A chip per role filters the list.
  const roles = page.getByTestId('users-roles');
  await roles.getByRole('link', { name: /مبيعات/ }).first().click();
  await expect(page).toHaveURL(/role=/);
  await expect(page.getByTestId('users-roles').getByRole('link')).not.toHaveCount(1);
  await gotoReady(page, '/dashboard/users');

  const table = page.getByTestId('users-table');
  await expect(table.locator('select[name="managerId"]').first()).toBeHidden();
  const change = table.getByText('تغيير').first();
  await change.click();
  await expect(table.locator('select[name="managerId"]').first()).toBeVisible();
});

/**
 * Settings: grouped lists with a link per section; a choice setting shows
 * and edits its value by name — no raw codes ("CLAWBACK") on the page.
 */
test('settings show choices by name and edit them from a list', async ({ page }) => {
  await gotoReady(page, '/dashboard/settings');
  await expect(page.getByTestId('settings-group').first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/CLAWBACK|RETAIN|REQUIRES_APPROVAL|REOPEN_AS_/);

  const row = page.getByTestId('setting-row').filter({ hasText: 'القسط بعد ارتداد الشيك' });
  if (await row.count()) {
    await row.getByRole('button', { name: 'تعديل الإعداد' }).click();
    const options = await row.locator('select[name="value"] option').allTextContents();
    expect(options).toEqual(['يعود متأخرًا', 'يعود مستحقًا']);
  }
});
