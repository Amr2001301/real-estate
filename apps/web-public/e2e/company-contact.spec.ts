import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * F37 — the floating WhatsApp button pointed at one hard-coded number for
 * every company on the platform, and the home search offered Saudi cities
 * (الرياض، جدة…) to an Egyptian developer. The button now uses the company's
 * WhatsApp from its branding, and the cities are the company's project cities.
 *
 * The site caches the branding for 60 s, so the number is polled for. The
 * city options must be exactly the company's project cities (the e2e seed's
 * projects happen to be Saudi).
 */
const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';
const SLUG = process.env.E2E_COMPANY_SLUG ?? 'default';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!';

async function adminHeaders(request: APIRequestContext) {
  const login = await request.post(`${API_BASE}/v1/auth/login-staff`, {
    data: { slug: SLUG, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).tokens.accessToken as string;
  return { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': SLUG };
}

test('the WhatsApp button and the city search belong to the company', async ({ page, request }) => {
  test.setTimeout(300_000);
  const headers = await adminHeaders(request);
  const before = (await (
    await request.get(`${API_BASE}/v1/company/branding`, { headers })
  ).json()) as { contactWhatsApp?: string | null };
  const setWhatsApp = async (value: string | null) =>
    expect(
      (
        await request.patch(`${API_BASE}/v1/company/branding`, {
          headers,
          data: { contactWhatsApp: value },
        })
      ).ok(),
    ).toBeTruthy();

  await setWhatsApp('+20 100 555 1234');
  try {
    // /units renders per request (the home page is ISR-cached on top of the
    // branding cache), so the new number shows there within a minute.
    const whatsappHref = async () => {
      await page.goto('/units', { waitUntil: 'networkidle' });
      // Short timeout: while the cached branding has no number the button is
      // absent, and a waiting getAttribute would eat the whole poll.
      return page
        .getByRole('link', { name: 'تواصل عبر واتساب' })
        .first()
        .getAttribute('href', { timeout: 2_000 })
        .catch(() => null);
    };
    await expect
      .poll(whatsappHref, { timeout: 120_000, intervals: [5_000] })
      .toBe('https://wa.me/201005551234');

    const cities = (await (
      await request.get(`${API_BASE}/v1/public/projects/cities`, {
        headers: { 'X-Tenant-Slug': SLUG },
      })
    ).json()) as { cities: string[] };
    await page.goto('/', { waitUntil: 'networkidle' });
    const options = await page.locator('select[aria-label="المدينة"] option').allTextContents();
    expect(options.slice(1).sort()).toEqual([...cities.cities].sort());
  } finally {
    await setWhatsApp(before.contactWhatsApp ?? null);
  }
});
