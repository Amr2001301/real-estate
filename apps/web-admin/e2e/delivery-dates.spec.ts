import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * F10 — handover dates: a phase's is set from the project page, and a unit
 * without its own shows the phase's on its page.
 */
test("a phase's handover date is set and its units show it", async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-7);
  const listed = await (await request.get(`${API_BASE}/v1/units?pageSize=1`, { headers })).json();
  const { buildingId, building } = listed.data[0] as { buildingId: string; building: { phaseId: string; phase: { projectId: string; deliveryDate: string | null } } };
  const created = await request.post(`${API_BASE}/v1/units`, {
    headers,
    data: { buildingId, code: `PW-DLV-${stamp}`, type: '2BR', area: 100, bedrooms: 2, floor: 1, pricePerMeter: 10_000 },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id as string;

  try {
    await gotoReady(page, `/dashboard/projects/${building.phase.projectId}`);
    const form = page.locator(`[data-testid="phase-delivery-form"][data-phase-id="${building.phaseId}"]`);
    await form.locator('input[name="deliveryDate"]').fill('2027-06-30');
    await form.getByRole('button', { name: 'حفظ' }).click();
    await expect(form.getByText('تم الحفظ')).toBeVisible();

    await gotoReady(page, `/dashboard/units/${id}`);
    await expect(page.getByText('2027-06-30 (موعد المرحلة)')).toBeVisible();
  } finally {
    await request.patch(`${API_BASE}/v1/phases/${building.phaseId}`, {
      headers,
      data: { deliveryDate: building.phase.deliveryDate?.slice(0, 10) ?? null },
    });
    await request.delete(`${API_BASE}/v1/units/${id}`, { headers });
  }
});
