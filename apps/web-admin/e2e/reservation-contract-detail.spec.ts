import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * The reservation and contract pages lead with their key figures, show the
 * parties in one card (no separate "quick actions" list) and, on a contract,
 * offer the plan changes one at a time in tabs.
 */
test.describe('reservation and contract detail pages', () => {
  test('a reservation shows its figures, journey and parties', async ({
    page,
    request,
    context,
  }) => {
    const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
    // A fresh DB has no reservation: book an available unit for a client.
    const get = async (path: string) =>
      await (await request.get(`${API_BASE}/v1${path}`, { headers })).json();
    const first = (body: { data?: { id: string }[] } | { id: string }[]) =>
      (Array.isArray(body) ? body : (body.data ?? []))[0]!;
    const unit = first(await get('/units?status=AVAILABLE&pageSize=1'));
    const client = first(await get('/users?role=CLIENT,CUSTOMER&limit=1'));
    const sales = first(await get('/users?role=SALES&limit=1'));
    const created = await request.post(`${API_BASE}/v1/reservations`, {
      headers,
      data: { unitId: unit.id, clientId: client.id, salesId: sales.id, notes: 'PW detail page' },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const id = ((await created.json()) as { id: string }).id;

    await gotoReady(page, `/dashboard/reservations/${id}`);
    await expect(page.getByTestId('reservation-kpis')).toContainText('مبلغ الحجز');
    await expect(page.getByTestId('reservation-journey').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('reservation-journey')).toContainText('إنشاء الحجز');
    await expect(page.getByTestId('reservation-parties')).toContainText('العميل');
    await expect(page.getByText('إجراءات سريعة')).toHaveCount(0);

    // Give the unit back for the other specs.
    await request.post(`${API_BASE}/v1/reservations/${id}/cancel`, {
      headers,
      data: { reason: 'PW cleanup' },
    });
  });

  test('a contract shows its figures and the plan changes as tabs', async ({
    page,
    request,
    context,
  }) => {
    const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
    const list = await request.get(`${API_BASE}/v1/contracts?q=E2E-CHQ-0001`, { headers });
    const id = (await list.json()).data[0].id as string;

    await gotoReady(page, `/dashboard/contracts/${id}`);
    const kpis = page.getByTestId('contract-kpis');
    await expect(kpis).toContainText('قيمة العقد');
    await expect(kpis).toContainText('المحصّل');
    await expect(kpis).toContainText('القسط القادم');
    await expect(page.getByTestId('contract-parties')).toContainText('العميل');
    await expect(page.getByText('إجراءات سريعة')).toHaveCount(0);

    // One plan change at a time: early settlement replaces the bulk payment.
    const changes = page.getByTestId('plan-changes');
    await expect(changes.getByTestId('pay-many-submit')).toBeVisible();
    await expect(changes.getByTestId('settle-submit')).toHaveCount(0);
    await changes.getByRole('tab', { name: 'سداد مبكر' }).click();
    await expect(changes.getByTestId('settle-submit')).toBeVisible();
    await expect(changes.getByTestId('pay-many-submit')).toHaveCount(0);
  });
});
