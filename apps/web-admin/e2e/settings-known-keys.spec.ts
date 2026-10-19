import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * F7 — the "add setting" list offered 22 keys and nothing read 19 of them
 * (two-factor authentication, company phone, broker payout cycle…), the
 * cancellation and cheque settings showed raw English keys, and the discount
 * cap could only be typed in by hand. The list now offers what the system
 * reads, every setting it reads has an Arabic name, and an old unused one is
 * marked as such.
 */
test('settings offer only what the system reads, named in Arabic', async ({
  page,
  request,
  context,
}) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  // A setting added from the old list: stored, but nothing reads it.
  const legacy = await request.patch(`${API_BASE}/v1/settings/security.requireMfa`, {
    headers,
    data: { value: true },
  });
  expect(legacy.ok()).toBeTruthy();

  await gotoReady(page, '/dashboard/settings');
  await expect(page.getByText('غرامة إلغاء العقد % من المدفوع')).toBeVisible();
  await expect(page.getByText('القسط بعد ارتداد الشيك', { exact: false })).toBeVisible();
  await expect(page.getByTestId('setting-unused')).toHaveCount(1);

  await page.getByRole('button', { name: 'إضافة إعداد' }).click();
  const options = await page
    .getByRole('dialog')
    .locator('select option:not([disabled])')
    .allTextContents();
  expect(options.join('|')).toContain('أقصى نسبة خصم مسموحة');
  expect(options.join('|')).not.toContain('المصادقة الثنائية');
  expect(options.join('|')).not.toContain('مخصص');
});
