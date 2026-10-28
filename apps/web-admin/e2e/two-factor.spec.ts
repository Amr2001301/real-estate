import { createHmac } from 'node:crypto';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG, login } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

/** RFC 6238 code for a base32 secret, as the authenticator app shows it. */
function totp(secretB32: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of secretB32.replace(/=+$/, '')) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const mac = createHmac('sha1', Buffer.from(bytes)).update(msg).digest();
  const o = mac[mac.length - 1]! & 0x0f;
  const bin = ((mac[o]! & 0x7f) << 24) | (mac[o + 1]! << 16) | (mac[o + 2]! << 8) | mac[o + 3]!;
  return String(bin % 1_000_000).padStart(6, '0');
}

/** A sign-in without the form (the form's route allows five a minute). */
async function signInByApi(context: BrowserContext, email: string, password: string) {
  const res = await context.request.post(`${API_BASE}/v1/auth/login`, { data: { email, password } });
  expect(res.ok(), await res.text()).toBe(true);
  const { tokens, user } = (await res.json()) as { tokens: { accessToken: string; refreshToken: string }; user: { id: string; role: string; fullName: string } };
  await context.addCookies([
    { name: 'access_token', value: tokens.accessToken, url: BASE_URL, httpOnly: true },
    { name: 'refresh_token', value: tokens.refreshToken, url: BASE_URL, httpOnly: true },
    { name: 'user', value: JSON.stringify({ id: user.id, role: user.role, fullName: user.fullName }), url: BASE_URL },
  ]);
}

/**
 * The form's sign-in route allows five a minute, and the global setup has
 * just used four: when it says to wait, wait and sign in again.
 */
async function formLogin(page: Page, email: string, password: string, landing: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await login(page, email, password, COMPANY_SLUG, landing);
      return;
    } catch (e) {
      const throttled = await page.getByText('محاولات كثيرة').isVisible().catch(() => false);
      if (!throttled || attempt >= 3) throw e;
      await page.waitForTimeout(20_000);
    }
  }
}

/**
 * TFA1 — a staff member turns on two-step sign-in from «الأمان والأجهزة»
 * and then signs in with a code; with the company rule on, another one sets
 * it up while signing in and sees their recovery codes. Own accounts: the
 * shared admin must keep signing in without a code.
 */
test.setTimeout(180_000);

test('two-step sign-in: turn it on, sign in with a code, and set it up when the company requires it', async ({ browser, request }) => {
  const admin = await browser.newContext({ storageState: ADMIN_STORAGE });
  const adminToken = (await admin.cookies()).find((c) => c.name === 'access_token')?.value;
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-8);
  const password = 'Tfa1PwPass123!';
  const made: string[] = [];
  const makeUser = async (n: number) => {
    const email = `tfa1-pw${n}-${stamp}@example.com`;
    const r = await request.post(`${API_BASE}/v1/users`, {
      headers: adminHeaders,
      data: { role: 'SALES', fullName: `تحقق ${n} ${stamp}`, email, phone: `+2016${n}${stamp.slice(1)}`, password },
    });
    expect(r.ok(), await r.text()).toBe(true);
    made.push(((await r.json()) as { id: string }).id);
    return email;
  };

  try {
    // 1) Turn it on from the security page.
    const first = await makeUser(1);
    const own = await browser.newContext();
    await signInByApi(own, first, password);
    const page = await own.newPage();
    await gotoReady(page, '/dashboard/security');
    const card = page.getByTestId('two-factor-card');
    await expect(card.getByTestId('two-factor-state')).toHaveText('غير مفعّل');
    await card.getByRole('button', { name: 'تفعيل التحقق بخطوتين' }).click();
    const secret = (await card.getByTestId('totp-secret').textContent())!.trim();
    await card.locator('input[name="code"]').fill('000000');
    await card.getByRole('button', { name: 'تأكيد وتفعيل' }).click();
    await expect(card.getByRole('alert')).toContainText('الكود غير صحيح');
    await card.locator('input[name="code"]').fill(totp(secret));
    await card.getByRole('button', { name: 'تأكيد وتفعيل' }).click();
    await expect(card.getByTestId('recovery-codes').locator('li')).toHaveCount(10);
    await expect(card.getByTestId('two-factor-state')).toHaveText('مفعّل');
    await own.close();

    // 2) Signing in now asks for the code (the next 30-second step: the one just used is spent).
    const again = await browser.newContext();
    const p2 = await again.newPage();
    await formLogin(p2, first, password, '/login/two-factor');
    await p2.locator('input[name="code"]').fill('111111');
    await p2.getByRole('button', { name: 'تأكيد' }).click();
    await expect(p2.getByText('الكود غير صحيح')).toBeVisible();
    await p2.locator('input[name="code"]').fill(totp(secret, Date.now() + 30_000));
    await p2.getByRole('button', { name: 'تأكيد' }).click();
    await p2.waitForURL(/\/dashboard/);
    await again.close();

    // 3) The company requires it: the next one sets it up while signing in.
    const put = await request.put(`${API_BASE}/v1/auth/2fa/policy`, { headers: adminHeaders, data: { mode: 'STAFF' } });
    expect(put.ok(), await put.text()).toBe(true);
    const second = await makeUser(2);
    const third = await browser.newContext();
    const p3 = await third.newPage();
    await formLogin(p3, second, password, '/login/two-factor/setup');
    const secret2 = (await p3.getByTestId('totp-secret').textContent())!.trim();
    await p3.locator('input[name="code"]').fill(totp(secret2));
    await p3.getByRole('button', { name: 'تفعيل ومتابعة' }).click();
    await expect(p3.getByTestId('recovery-codes').locator('li')).toHaveCount(10);
    await p3.getByRole('link', { name: 'حفظتها — متابعة' }).click();
    await p3.waitForURL(/\/dashboard/);
    await third.close();
  } finally {
    await request.put(`${API_BASE}/v1/auth/2fa/policy`, { headers: adminHeaders, data: { mode: 'OFF' } });
    // Deleted, not only deactivated: an inactive account still holds a seat on the plan.
    for (const id of made) await request.delete(`${API_BASE}/v1/users/${id}`, { headers: adminHeaders });
    await admin.close();
  }
});
