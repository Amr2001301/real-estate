import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE, BROKER_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * More small findings from the manual walk-through:
 * - F30: «تسجيل التسليم» recorded the handover in one click, with today's
 *   date and an empty checklist; it now asks first.
 * - F34: «قيمة العقود − المحصّل» ≠ «المتبقي» with no word why (the value is
 *   net, the schedule carries the instalment markup).
 * - F26: the broker-leads rows had no link on the lead; the portal's lead
 *   search came back empty without saying a lead waits for approval.
 */
test.describe('admin', () => {
  test.use({ storageState: ADMIN_STORAGE });

  test('F30: recording a handover asks first', async ({ page, request, context }) => {
    const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
    expect(token).toBeTruthy();
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
    const stamp = Date.now().toString().slice(-7);
    const units = await (
      await request.get(`${API_BASE}/v1/units?status=AVAILABLE&pageSize=1`, { headers })
    ).json();
    const unit = await request.post(`${API_BASE}/v1/units`, {
      headers,
      data: {
        buildingId: units.data[0].buildingId,
        code: `PW-HO-${stamp}`,
        type: '2BR',
        area: 100,
        bedrooms: 2,
        bathrooms: 1,
        floor: 1,
        price: 1_000_000,
      },
    });
    expect(unit.status()).toBe(201);
    const customers = await (
      await request.get(`${API_BASE}/v1/users?role=CUSTOMER&pageSize=1`, { headers })
    ).json();
    const created = await request.post(`${API_BASE}/v1/contracts`, {
      headers,
      data: { customerId: customers.data[0].id, unitId: (await unit.json()).id, totalAmount: 1_000_000 },
    });
    expect(created.status()).toBe(201);
    const contractId = (await created.json()).id as string;
    expect(
      (
        await request.post(`${API_BASE}/v1/contracts/${contractId}/sign`, {
          headers,
          data: { signedAt: new Date().toISOString().slice(0, 10) },
        })
      ).ok(),
    ).toBeTruthy();

    await gotoReady(page, `/dashboard/contracts/${contractId}`);
    const form = page.getByTestId('handover-form');
    await expect(form).toBeVisible();

    // Dismissed: nothing is recorded.
    let asked = '';
    page.once('dialog', (d) => {
      asked = d.message();
      void d.dismiss();
    });
    await form.getByRole('button', { name: 'تسجيل التسليم' }).click();
    await expect.poll(() => asked).toContain('لا يمكن التراجع');
    await expect(page.getByTestId('handover-form')).toBeVisible();
    expect((await (await request.get(`${API_BASE}/v1/contracts/${contractId}`, { headers })).json()).handover ?? null).toBeNull();

    // Accepted: recorded.
    page.once('dialog', (d) => void d.accept());
    await form.getByRole('button', { name: 'تسجيل التسليم' }).click();
    await expect(page.getByTestId('handover-recorded')).toBeVisible();
  });

  test('F34: the financial report says what the value and the outstanding hold', async ({ page }) => {
    await gotoReady(page, '/dashboard/reports/financial');
    await expect(page.getByText('إجمالي قيمة العقود (الصافي)').first()).toBeVisible();
    await expect(page.getByText('المتبقي للتحصيل (شامل فوائد التقسيط)').first()).toBeVisible();
  });

  test('F26: a broker lead row links to the lead', async ({ page }) => {
    await gotoReady(page, '/dashboard/broker-leads');
    const name = page.getByTestId('broker-lead-link').first();
    await expect(name).toBeVisible();
    await name.click();
    await expect(page).toHaveURL(/\/dashboard\/broker-leads\/[0-9a-f-]{36}$/);
  });
});

test.describe('broker', () => {
  test.use({ storageState: BROKER_STORAGE });

  test('F26: an empty lead search says a new lead needs approval', async ({ page }) => {
    await gotoReady(page, '/portal/reservations/new');
    const empty = page.getByText('الفرصة الجديدة تظهر هنا بعد موافقة الشركة عليها');
    // The typed text is searched on the API after a short pause.
    await expect(async () => {
      await page.locator('#leadId').fill(`zz-no-such-lead-${Date.now()}`, { timeout: 2_000 });
      await expect(empty).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  });
});
