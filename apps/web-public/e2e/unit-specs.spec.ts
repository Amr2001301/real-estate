import { test, expect } from '@playwright/test';

/**
 * F10 — the public unit page showed one area and the bedrooms, even for a
 * shop. It now shows the unit's finishing, its other areas, view and
 * orientation (and its price per meter and model), and the units list filters by
 * finishing.
 */
const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';
const SLUG = process.env.E2E_COMPANY_SLUG ?? 'default';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!';

test('a unit page shows its specs and the list filters by finishing', async ({ page, request }) => {
  const login = await request.post(`${API_BASE}/v1/auth/login-staff`, {
    data: { slug: SLUG, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const headers = {
    Authorization: `Bearer ${(await login.json()).tokens.accessToken as string}`,
    'X-Tenant-Slug': SLUG,
  };
  const listed = await (await request.get(`${API_BASE}/v1/units?pageSize=100`, { headers })).json();
  const published = (
    listed.data as Array<{ buildingId: string; building: { phase: { projectId: string; project: { status: string } } } }>
  ).find(
    (u) => u.building.phase.project.status === 'PUBLISHED',
  );
  expect(published).toBeTruthy();
  const stamp = Date.now().toString().slice(-7);
  const make = async (code: string, data: Record<string, unknown>) => {
    const res = await request.post(`${API_BASE}/v1/units`, {
      headers,
      data: { buildingId: published!.buildingId, code, area: 120, bathrooms: 1, floor: 2, price: 2_000_000, ...data },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).id as string;
  };
  // One of the project's models.
  const model = await request.post(`${API_BASE}/v1/projects/${published!.building.phase.projectId}/unit-models`, {
    headers,
    data: { code: `PUB${stamp}`, ar: `نموذج ${stamp}`, en: `Model ${stamp}`, type: '2BR', area: 120, bedrooms: 2 },
  });
  expect(model.status()).toBe(201);
  const modelId = (await model.json()).id as string;
  const furnished = await make(`PUB-SPEC-${stamp}`, {
    modelId,
    deliveryDate: '2025-01-01',
    type: '2BR',
    bedrooms: 2,
    pricePerMeter: 20_000,
    netArea: 105,
    terraceArea: 18,
    finishing: 'FURNISHED',
    view: 'SEA',
    orientation: 'SOUTH_EAST',
  });
  const shop = await make(`PUB-SHOP-${stamp}`, { type: 'Shop', finishing: 'CORE_AND_SHELL' });

  try {
    await page.goto(`/units/${furnished}`, { waitUntil: 'networkidle' });
    const main = page.locator('main');
    for (const text of ['المساحة الصافية', 'التراس', 'مفروشة', 'بحر', 'قبلي شرقي', 'النموذج', `نموذج ${stamp}`, 'استلام فوري']) {
      await expect(main.getByText(text, { exact: true }).first()).toBeVisible();
    }
    // Priced by the meter: 20,000 × 120 m².
    await expect(page.getByTestId('unit-price-per-meter')).toContainText('للمتر');
    await expect(page.getByTestId('unit-price-per-meter')).toContainText('٢٠٬٠٠٠');

    // A shop has no bedrooms.
    await page.goto(`/units/${shop}`, { waitUntil: 'networkidle' });
    await expect(page.locator('main').getByText('على الطوب', { exact: true }).first()).toBeVisible();
    await expect(page.locator('main').getByText('غرف النوم', { exact: true })).toHaveCount(0);

    await page.goto(`/units?finishing=FURNISHED&stamp=${stamp}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('combobox', { name: 'التشطيب' })).toHaveValue('FURNISHED');
    await expect(page.locator(`main a[href="/units/${furnished}"]`).first()).toBeVisible();
    await expect(page.locator(`main a[href="/units/${shop}"]`)).toHaveCount(0);

    // Ready now: the shop has no handover date.
    await page.goto(`/units?delivery=now&finishing=FURNISHED`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('combobox', { name: 'التسليم' })).toHaveValue('now');
    await expect(page.locator(`main a[href="/units/${furnished}"]`).first()).toBeVisible();
  } finally {
    await request.delete(`${API_BASE}/v1/units/${furnished}`, { headers });
    await request.delete(`${API_BASE}/v1/units/${shop}`, { headers });
    await request.patch(`${API_BASE}/v1/unit-models/${modelId}`, { headers, data: { active: false } });
  }
});
