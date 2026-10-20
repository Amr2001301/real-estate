import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * F10 — a project's unit models: the admin adds a model to the project, and
 * picking it on the new-unit form fills the unit's type, areas and rooms.
 */
test('a project model is added and fills the new unit form', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-6);
  const listed = await (await request.get(`${API_BASE}/v1/units?pageSize=1`, { headers })).json();
  const projectId = listed.data[0].building.phase.projectId as string;

  await gotoReady(page, `/dashboard/projects/${projectId}/models`);
  const add = page.getByTestId('unit-model-add');
  await add.locator('input[name="code"]').fill(`M${stamp}`);
  await add.locator('input[name="ar"]').fill(`فيلا نموذج ${stamp}`);
  await add.locator('input[name="en"]').fill(`Villa model ${stamp}`);
  await add.locator('select[name="type"]').selectOption('Villa');
  await add.locator('input[name="area"]').fill('300');
  await add.locator('input[name="gardenArea"]').fill('120');
  await add.locator('input[name="bedrooms"]').fill('4');
  await add.locator('select[name="finishing"]').selectOption('SEMI_FINISHED');
  await add.getByRole('button', { name: 'إضافة نموذج' }).click();
  await expect(page.getByText('تم الحفظ.')).toBeVisible();
  const row = page.getByTestId('unit-model-row').filter({ hasText: `M${stamp}` });
  await expect(row).toHaveCount(1);

  await gotoReady(page, '/dashboard/units/new');
  await page.locator('select#project').selectOption(projectId);
  const model = page.locator('select[name="modelId"]');
  await expect(model.locator('option', { hasText: `M${stamp}` })).toHaveCount(1);
  await model.selectOption({ label: `M${stamp} — فيلا نموذج ${stamp}` });
  await expect(page.locator('select[name="type"]')).toHaveValue('Villa');
  await expect(page.locator('input[name="area"]')).toHaveValue('300');
  await expect(page.locator('input[name="gardenArea"]')).toHaveValue('120');
  await expect(page.locator('input[name="bedrooms"]:not([type="hidden"])')).toHaveValue('4');
  await expect(page.locator('select[name="finishing"]')).toHaveValue('SEMI_FINISHED');

  // Switched off, so later runs' lists stay short.
  const models = await (await request.get(`${API_BASE}/v1/projects/${projectId}/unit-models`, { headers })).json();
  const created = (models as Array<{ id: string; code: string }>).find((x) => x.code === `M${stamp}`);
  await request.patch(`${API_BASE}/v1/unit-models/${created!.id}`, { headers, data: { active: false } });
});
