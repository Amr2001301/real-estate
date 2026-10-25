import { test, expect } from '@playwright/test';

/**
 * MA1 — the platform owner gives a company its own customer app: name,
 * package id and status on the company page, then takes it back (the company
 * returns to the shared app).
 */
const EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? 'platform@example.com';
const PASSWORD = process.env.E2E_SUPER_ADMIN_PASSWORD ?? 'PlatformPass1!!';
const COMPANY_ID = process.env.E2E_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

test('the super admin sets up a company app and removes it', async ({ page }) => {
  const packageId = `com.pwtest${Date.now().toString().slice(-7)}.app`;
  await page.goto('/super-admin/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20_000 }),
    page.locator('form button[type=submit]').click(),
  ]);

  await page.goto(`/dashboard/super-admin/companies/${COMPANY_ID}`, { waitUntil: 'networkidle' });
  const panel = page.getByTestId('mobile-app-panel');
  const card = page.locator('section', { has: panel });
  // A run that died half-way may have left an app behind: start from none.
  if (await card.getByRole('button', { name: 'تعديل' }).isVisible()) {
    page.once('dialog', (d) => void d.accept());
    await card.getByRole('button', { name: 'تعديل' }).click();
    await card.getByRole('button', { name: 'إلغاء التطبيق الخاص' }).click();
  }
  await expect(panel).toContainText('تطبيق المنصة العام');

  await card.getByRole('button', { name: 'إعداد تطبيق خاص' }).click();
  await panel.locator('input[name=appNameAr]').fill('بيوت التجربة');
  await panel.locator('input[name=appNameEn]').fill('Test Homes');
  await panel.locator('input[name=packageId]').fill(packageId);
  await panel.locator('select[name=status]').selectOption('IN_REVIEW');
  await panel.getByRole('button', { name: 'حفظ' }).click();

  await expect(panel).toContainText(packageId);
  await expect(panel).toContainText('بيوت التجربة');
  await expect(panel).toContainText('قيد المراجعة في المتجر');

  // Saved on the server, not only on the page.
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('mobile-app-panel')).toContainText(packageId);

  page.once('dialog', (d) => void d.accept());
  await card.getByRole('button', { name: 'تعديل' }).click();
  await card.getByRole('button', { name: 'إلغاء التطبيق الخاص' }).click();
  await expect(panel).toContainText('تطبيق المنصة العام');
});
