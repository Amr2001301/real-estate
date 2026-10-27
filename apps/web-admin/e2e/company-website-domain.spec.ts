import { test, expect } from '@playwright/test';

/**
 * D1 — «دومين الموقع»: the platform owner adds a company's website domain on
 * the company page and gets the records to set at the domain provider, then
 * removes it. The company's own dashboard has no domains page any more.
 */
const EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? 'platform@example.com';
const PASSWORD = process.env.E2E_SUPER_ADMIN_PASSWORD ?? 'PlatformPass1!!';
const COMPANY_ID = process.env.E2E_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

test('the super admin connects a website domain and removes it', async ({ page }) => {
  const hostname = `pw-${Date.now().toString().slice(-8)}.example.com`;
  await page.goto('/super-admin/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20_000 }),
    page.locator('form button[type=submit]').click(),
  ]);

  await page.goto(`/dashboard/super-admin/companies/${COMPANY_ID}`, { waitUntil: 'networkidle' });
  const panel = page.getByTestId('website-domain-panel');
  // With a domain there already, the form opens from "add another".
  const another = panel.getByRole('button', { name: 'إضافة دومين آخر' });
  if (await another.isVisible()) await another.click();
  await panel.getByRole('textbox').fill(`https://${hostname}/`);
  await panel.getByRole('button', { name: 'إضافة' }).click();

  // Pasted as a link, kept as the host; its records are listed to copy.
  const card = panel.getByTestId('domain-card').filter({ hasText: hostname });
  await expect(card).toBeVisible();
  await expect(card).toContainText('بانتظار الربط');
  // Names as DNS panels ask for them, not the full host.
  await expect(card.getByTestId('dns-record').first()).toContainText('pw-');
  await expect(card.getByTestId('dns-record')).not.toHaveCount(0);
  await expect(card.getByRole('button', { name: 'نسخ كل السجلات' })).toBeVisible();

  page.once('dialog', (d) => void d.accept());
  await card.getByRole('button', { name: 'حذف' }).click();
  await expect(card).toHaveCount(0);
});
