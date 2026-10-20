import { test, expect } from '@playwright/test';
import { API_BASE, SLUG, adminApiHeaders } from './helpers/staff';

/**
 * F10 — a project's type, district, land area and license number show on its
 * public page, and the projects list filters by type. The site caches pages
 * briefly, so the change is polled for.
 */

test("a project's data shows on its page and filters the list", async ({ page, request }) => {
  test.setTimeout(300_000);
  const headers = await adminApiHeaders(request);
  const pub = await (await request.get(`${API_BASE}/v1/public/projects?pageSize=1`, { headers: { 'X-Tenant-Slug': SLUG } })).json();
  const id = pub.data[0].id as string;
  const set = (data: Record<string, unknown>) => request.patch(`${API_BASE}/v1/projects/${id}`, { headers, data });

  try {
    expect((await set({ type: 'MEDICAL', district: 'الشيخ زايد', totalArea: 50_000, licenseNumber: 'PUB-77/2026' })).ok()).toBeTruthy();

    const projectText = async () => {
      await page.goto(`/projects/${id}`, { waitUntil: 'networkidle' });
      return page.locator('main').innerText();
    };
    await expect.poll(projectText, { timeout: 120_000, intervals: [5_000] }).toContain('PUB-77/2026');
    const main = page.locator('main');
    await expect(main).toContainText('طبي');
    await expect(main).toContainText('الشيخ زايد');

    await page.goto('/projects?type=MEDICAL', { waitUntil: 'networkidle' });
    await expect(page.getByRole('combobox', { name: 'نوع المشروع' })).toHaveValue('MEDICAL');
    await expect(page.locator(`main a[href="/projects/${id}"]`).first()).toBeVisible();
  } finally {
    await set({ type: null, district: null, totalArea: null, licenseNumber: null });
  }
});
