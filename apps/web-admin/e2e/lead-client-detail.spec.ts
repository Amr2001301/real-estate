import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * A reservation booked on a client's lead belongs to that client: the client
 * page lists it (it listed only reservations carrying the client directly).
 * The lead's activity reads in Arabic, with no raw event names.
 */
test('a client sees the reservation booked on their lead; the lead activity reads in Arabic', async ({
  page,
  request,
  context,
}) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const get = async (path: string) => (await (await request.get(`${API_BASE}/v1${path}`, { headers })).json());
  const client = (await get('/users?role=CLIENT&pageSize=1')).data[0];
  const unit = (await get('/units?status=AVAILABLE&pageSize=1')).data[0];
  const sales = (await get('/users?role=SALES&pageSize=1')).data[0];

  const lead = await request.post(`${API_BASE}/v1/leads`, {
    headers,
    data: { clientId: client.id, assignedSalesId: sales.id },
  });
  expect(lead.ok(), await lead.text()).toBe(true);
  const leadId = ((await lead.json()) as { id: string }).id;
  const res = await request.post(`${API_BASE}/v1/reservations`, {
    headers,
    data: { unitId: unit.id, leadId, salesId: sales.id },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const reservation = (await res.json()) as { id: string; reservationNumber: string };

  try {
    await gotoReady(page, `/dashboard/clients/${client.id}`);
    await expect(page.getByTestId('client-reservations')).toContainText(reservation.reservationNumber);

    await gotoReady(page, `/dashboard/leads/${leadId}`);
    const activity = page.getByTestId('lead-activity');
    await expect(activity).toContainText('تم إنشاء الفرصة');
    await expect(activity).not.toContainText(/\b(created|visit|status_change|reservation)\b/);
    await expect(page.getByTestId('stage-journey')).toBeVisible();
  } finally {
    await request.post(`${API_BASE}/v1/reservations/${reservation.id}/cancel`, { headers, data: { reason: 'PW cleanup' } });
  }
});
