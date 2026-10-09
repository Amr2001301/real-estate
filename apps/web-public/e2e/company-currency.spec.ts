import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Prices on the public site follow the company currency the admin picks on the
 * branding page (Company.currency, read through the public branding) — they
 * were hard-coded to ج.م, and the product JSON-LD to SAR.
 *
 * The site caches the branding for 60 s, so the switch is polled for.
 */
const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';
const SLUG = process.env.E2E_COMPANY_SLUG ?? 'default';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!';

async function setCurrency(request: APIRequestContext, currency: string): Promise<void> {
  const login = await request.post(`${API_BASE}/v1/auth/login-staff`, {
    data: { slug: SLUG, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).tokens.accessToken as string;
  const res = await request.patch(`${API_BASE}/v1/company/branding`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': SLUG },
    data: { currency },
  });
  expect(res.ok()).toBeTruthy();
}

test.afterAll(async ({ request }) => {
  await setCurrency(request, 'EGP');
});

test('unit prices and the product JSON-LD follow the company currency', async ({ page, request }) => {
  test.setTimeout(300_000);

  const unitsText = async () => {
    await page.goto('/units', { waitUntil: 'networkidle' });
    return page.locator('main').innerText();
  };

  // Start from EGP (a previous run may have left the cached branding on SAR).
  await setCurrency(request, 'EGP');
  await expect.poll(unitsText, { timeout: 120_000, intervals: [5_000] }).toContain('ج.م');

  await setCurrency(request, 'SAR');
  await expect.poll(unitsText, { timeout: 120_000, intervals: [5_000] }).toContain('ر.س');
  expect(await page.locator('main').innerText()).not.toContain('ج.م');

  // A unit page: the price and the structured data.
  const href = await page.locator('main a[href^="/units/"]').first().getAttribute('href');
  expect(href).toBeTruthy();
  await page.goto(href!, { waitUntil: 'networkidle' });
  await expect(page.locator('main')).toContainText('ر.س');
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((t) => t.includes('"priceCurrency":"SAR"'))).toBeTruthy();
});
