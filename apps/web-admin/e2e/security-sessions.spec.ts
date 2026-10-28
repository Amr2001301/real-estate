import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG, login } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * SES1 — a staff member sees the devices they are signed in on, signs one out
 * (it stops at once), and changes their password; the admin sees the same
 * devices and signs them out everywhere. Uses its own account: signing the
 * shared admin out would break the other specs.
 */
test('signed-in devices: see them, sign one out, and the admin signs out everywhere', async ({ browser, request }) => {
  const admin = await browser.newContext({ storageState: ADMIN_STORAGE });
  const adminToken = (await admin.cookies()).find((c) => c.name === 'access_token')?.value;
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-8);
  const email = `ses1-pw-${stamp}@example.com`;
  const password = 'Ses1PwPass123!';
  const created = await request.post(`${API_BASE}/v1/users`, {
    headers: adminHeaders,
    data: { role: 'SALES', fullName: `أجهزة ${stamp}`, email, phone: `+2015${stamp}`, password },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const userId = ((await created.json()) as { id: string }).id;

  try {
    // A phone signed in first (the older sign-in route: /login-staff allows
    // five a minute, and the form below and the global setup use it).
    const phoneLogin = await request.post(`${API_BASE}/v1/auth/login`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari/604.1' },
      data: { email, password },
    });
    expect(phoneLogin.ok(), await phoneLogin.text()).toBe(true);
    const phoneToken = ((await phoneLogin.json()) as { tokens: { accessToken: string } }).tokens.accessToken;

    const own = await browser.newContext();
    const page = await own.newPage();
    await login(page, email, password);
    await gotoReady(page, '/dashboard/security');
    const rows = page.getByTestId('session-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'هذا الجهاز' })).toHaveCount(1);
    const phoneRow = rows.filter({ hasText: 'iOS' });
    await expect(phoneRow).toBeVisible();
    await phoneRow.getByRole('button', { name: 'تسجيل خروج' }).click();
    await expect(rows).toHaveCount(1);
    const after = await request.get(`${API_BASE}/v1/auth/sessions`, { headers: { Authorization: `Bearer ${phoneToken}` } });
    expect(after.status()).toBe(401);

    // Password: a mismatch is caught here; a real change keeps this device signed in.
    const form = page.getByTestId('change-password-form');
    await form.locator('input[name="currentPassword"]').fill(password);
    await form.locator('input[name="newPassword"]').fill('Ses1PwNew123!');
    await form.locator('input[name="confirmPassword"]').fill('Ses1PwOther123!');
    await form.getByRole('button', { name: 'حفظ كلمة المرور' }).click();
    await expect(form.getByRole('alert')).toContainText('غير متطابقتين');
    await expect(form.locator('input[name="currentPassword"]')).toHaveValue(password);
    await form.locator('input[name="confirmPassword"]').fill('Ses1PwNew123!');
    await form.getByRole('button', { name: 'حفظ كلمة المرور' }).click();
    await expect(form.getByRole('status')).toBeVisible();
    await gotoReady(page, '/dashboard/security');
    await expect(rows).toHaveCount(1);

    // The admin sees the device and signs them out everywhere.
    const adminPage = await admin.newPage();
    await gotoReady(adminPage, `/dashboard/users/${userId}/sessions`);
    await expect(adminPage.getByTestId('session-row')).toHaveCount(1);
    await adminPage.getByRole('button', { name: 'تسجيل خروجه من كل الأجهزة' }).click();
    await expect(adminPage.getByText('غير مسجّل دخول على أي جهاز')).toBeVisible();
    await own.close();
  } finally {
    await request.patch(`${API_BASE}/v1/users/${userId}/deactivate`, { headers: adminHeaders });
    await admin.close();
  }
});
