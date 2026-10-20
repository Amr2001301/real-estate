import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * F10 — a project's type, district, land area and license number are entered
 * on its form and shown on its page.
 */
test("the project form takes the project's data and its page shows it", async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const listed = await (await request.get(`${API_BASE}/v1/projects?pageSize=1`, { headers })).json();
  const id = listed.data[0].id as string;

  try {
    await gotoReady(page, `/dashboard/projects/${id}/edit`);
    await page.locator('input[name="district"]').fill('التجمع الخامس');
    await page.locator('select[name="type"]').selectOption('COASTAL');
    await page.locator('input[name="totalArea"]').fill('420000');
    await page.locator('input[name="licenseNumber"]').fill('PW-123/2026');
    await page.getByRole('button', { name: 'حفظ التغييرات' }).click();
    await expect(page.getByText('تم حفظ التغييرات')).toBeVisible();

    await gotoReady(page, `/dashboard/projects/${id}`);
    await expect(page.getByText('التجمع الخامس ·', { exact: false })).toBeVisible();
    const data = page.getByTestId('project-data');
    await expect(data).toContainText('ساحلي');
    await expect(data).toContainText('420,000');
    await expect(data).toContainText('PW-123/2026');
  } finally {
    await request.patch(`${API_BASE}/v1/projects/${id}`, {
      headers,
      data: { type: null, district: null, totalArea: null, licenseNumber: null },
    });
  }
});
