import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * F10 — units priced by the meter: the unit form takes the price per meter
 * and computes the total from the area (no total to type), and a new price per meter is applied to the
 * units for sale of a project at once.
 */
test('a unit is priced by the meter, then repriced with its project', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-7);

  // A type of its own, so the reprice touches this test's units only.
  const type = await request.post(`${API_BASE}/v1/unit-types`, {
    headers,
    data: { ar: `نوع تسعير ${stamp}`, en: `PW Meter ${stamp}`, usage: 'RESIDENTIAL' },
  });
  expect(type.status()).toBe(201);
  const typeCode = (await type.json()).code as string;
  const listed = await (await request.get(`${API_BASE}/v1/units?pageSize=1`, { headers })).json();
  const projectId = listed.data[0].building.phase.projectId as string;
  const created = await request.post(`${API_BASE}/v1/units`, {
    headers,
    data: { buildingId: listed.data[0].buildingId, code: `PW-PPM-${stamp}`, type: typeCode, area: 100, bedrooms: 2, floor: 1, price: 900_000 },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id as string;
  const unitPrice = async () => {
    const u = await (await request.get(`${API_BASE}/v1/units/${id}`, { headers })).json();
    return { price: Number(u.price), pricePerMeter: u.pricePerMeter === null ? null : Number(u.pricePerMeter) };
  };

  // The form: price per meter × area.
  await gotoReady(page, `/dashboard/units/${id}/edit`);
  // No total to type: a unit priced as a whole shows its price ÷ area.
  await expect(page.locator('input[name="price"]')).toHaveCount(0);
  await expect(page.locator('input[name="pricePerMeter"]')).toHaveValue('9000');
  await expect(page.getByTestId('unit-meter-price')).toHaveValue('900000');
  await page.locator('input[name="area"]').fill('150');
  await page.locator('input[name="pricePerMeter"]').fill('10000');
  await expect(page.getByTestId('unit-meter-price')).toHaveValue('1500000');
  await page.getByRole('button', { name: 'حفظ التغييرات' }).click();
  await expect(page.getByText('تم حفظ التغييرات بنجاح')).toBeVisible();
  expect(await unitPrice()).toEqual({ price: 1_500_000, pricePerMeter: 10_000 });

  // The project, this type: preview, then apply.
  await gotoReady(page, '/dashboard/units/reprice');
  const form = page.getByTestId('reprice-form');
  await form.locator('select[name="projectId"]').selectOption(projectId);
  await form.locator('select[name="type"]').selectOption(typeCode);
  await form.locator('input[name="pricePerMeter"]').fill('12000');
  await form.getByRole('button', { name: 'معاينة' }).click();
  await expect(page.getByTestId('reprice-result')).toContainText('سيتغير سعر 1 وحدة متاحة');
  expect((await unitPrice()).price).toBe(1_500_000);

  page.once('dialog', (d) => void d.accept());
  await form.getByRole('button', { name: 'تطبيق السعر' }).click();
  await expect(page.getByTestId('reprice-result')).toContainText('تم تحديث سعر 1 وحدة');
  expect(await unitPrice()).toEqual({ price: 1_800_000, pricePerMeter: 12_000 });

  await request.delete(`${API_BASE}/v1/units/${id}`, { headers });
});
