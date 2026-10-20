import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * The project and unit pages open on a hero with the key figures under it;
 * the project's unit mix counts every unit (not the first page of them), and
 * neither page carries a separate shortcuts list.
 */
test('the project page shows the full unit mix and no shortcuts list', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const get = async (path: string) => (await (await request.get(`${API_BASE}/v1${path}`, { headers })).json());
  const unit = (await get('/units?pageSize=1')).data[0];
  const unitFull = await get(`/units/${unit.id}`);
  const projectId = unitFull.building.phase.project.id as string;
  const available = (await get(`/units?projectId=${projectId}&status=AVAILABLE&pageSize=1`)).meta.total as number;

  await gotoReady(page, `/dashboard/projects/${projectId}`);
  await expect(page.getByTestId('project-hero')).toBeVisible();
  const kpis = page.getByTestId('project-kpis');
  await expect(kpis).toContainText('نسبة الإشغال');
  await expect(kpis).toContainText(`متاحة${available}`);
  await expect(page.getByText('إدارة الأصول')).toHaveCount(0);
});

test('the unit page shows its facts and location, with no shortcuts list', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const unit = (await (await request.get(`${API_BASE}/v1/units?pageSize=1`, { headers })).json()).data[0];

  await gotoReady(page, `/dashboard/units/${unit.id}`);
  await expect(page.getByTestId('unit-hero')).toContainText(unit.code);
  await expect(page.getByTestId('unit-facts')).toContainText('المساحة');
  await expect(page.getByTestId('unit-location')).toContainText('المشروع');
  await expect(page.getByText('إجراءات سريعة')).toHaveCount(0);
});
