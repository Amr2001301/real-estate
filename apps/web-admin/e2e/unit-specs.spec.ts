import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * F10 — a unit had one area and nothing else. Its finishing, net/garden/roof
 * areas, view and orientation are entered on the unit form and shown on the
 * unit's page; an emptied field is cleared.
 */
test('the unit form takes the specs and the unit page shows them', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-7);
  const units = await (await request.get(`${API_BASE}/v1/units?pageSize=1`, { headers })).json();
  const created = await request.post(`${API_BASE}/v1/units`, {
    headers,
    data: {
      buildingId: units.data[0].buildingId,
      code: `PW-SPEC-${stamp}`,
      type: '3BR',
      area: 200,
      bedrooms: 3,
      bathrooms: 2,
      floor: 1,
      price: 4_000_000,
      roofArea: 30,
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id as string;

  await gotoReady(page, `/dashboard/units/${id}/edit`);
  await page.locator('input[name="netArea"]').fill('170');
  await page.locator('input[name="gardenArea"]').fill('80');
  await page.locator('input[name="roofArea"]').fill('');
  await page.locator('select[name="finishing"]').selectOption('SEMI_FINISHED');
  await page.locator('select[name="view"]').selectOption('LAGOON');
  await page.locator('select[name="orientation"]').selectOption('NORTH');
  await page.getByRole('button', { name: 'حفظ التغييرات' }).click();
  await expect(page.getByText('تم حفظ التغييرات بنجاح')).toBeVisible();

  await gotoReady(page, `/dashboard/units/${id}`);
  for (const text of ['المساحة الصافية', '170 م²', 'الحديقة', '80 م²', 'نصف تشطيب', 'لاجون', 'بحري']) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText('الروف', { exact: true })).toHaveCount(0);

  const unit = await (await request.get(`${API_BASE}/v1/units/${id}`, { headers })).json();
  expect(unit).toMatchObject({ netArea: 170, gardenArea: 80, roofArea: null, finishing: 'SEMI_FINISHED', view: 'LAGOON', orientation: 'NORTH' });
  await request.delete(`${API_BASE}/v1/units/${id}`, { headers });
});
