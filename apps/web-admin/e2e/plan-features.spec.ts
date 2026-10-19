import { test, expect, type APIRequestContext } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';
const SUPER_EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? 'platform@example.com';
const SUPER_PASSWORD = process.env.E2E_SUPER_ADMIN_PASSWORD ?? 'PlatformPass1!!';

/**
 * F36 — on a plan without maintenance (Professional) the sidebar still showed
 * "الصيانة", its page said only "ليست لديك صلاحية الوصول إلى هذا المورد", and
 * the admin could create a maintenance supervisor whose app refused
 * everything. The page is now hidden, the refusal names the plan, and the
 * role is not offered.
 */
async function superToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/v1/auth/login-super-admin`, {
    data: { email: SUPER_EMAIL, password: SUPER_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).tokens.accessToken as string;
}

test('a plan without maintenance hides it and says why', async ({ page, request }) => {
  const auth = { Authorization: `Bearer ${await superToken(request)}` };
  const companies = (await (
    await request.get(`${API_BASE}/v1/super-admin/companies`, { headers: auth })
  ).json()) as Array<{ id: string; slug: string }>;
  const companyId = companies.find((c) => c.slug === COMPANY_SLUG)!.id;
  const setMaintenance = async (on: boolean) =>
    expect(
      (
        await request.put(
          `${API_BASE}/v1/super-admin/companies/${companyId}/capabilities/overrides`,
          {
            headers: auth,
            data: { overrides: { 'feature.maintenance': on } },
          },
        )
      ).ok(),
    ).toBeTruthy();

  await setMaintenance(false);
  try {
    await gotoReady(page, '/dashboard');
    await expect(page.locator('a[href="/dashboard/maintenance"]')).toHaveCount(0);

    await gotoReady(page, '/dashboard/maintenance');
    await expect(page.getByText('«الصيانة» غير مشمولة في باقة شركتك').first()).toBeVisible();

    await gotoReady(page, '/dashboard/users?showCreate=1');
    const roles = page.locator('form:has(input[name="password"]) select[name="role"] option');
    await expect(roles.first()).toBeAttached();
    const values = await roles.evaluateAll((o) => o.map((e) => e.getAttribute('value')));
    expect(values).not.toContain('MAINTENANCE_SUPERVISOR');
  } finally {
    await setMaintenance(true);
  }
});
