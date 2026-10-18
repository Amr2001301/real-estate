import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * A time typed in the dashboard is the company's (Cairo). The server action
 * parsed it with the server's zone — UTC on Vercel and in CI — so a visit
 * rescheduled to 1:00 pm was stored as 1:00 pm UTC (3:00 pm Cairo in
 * December), and the customer app and reminders showed the wrong time.
 */
test('a visit rescheduled to 1:00 pm is stored as 1:00 pm Cairo', async ({
  page,
  request,
  context,
}) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const [customers, projects] = await Promise.all([
    request.get(`${API_BASE}/v1/users?role=CUSTOMER&pageSize=1`, { headers }).then((r) => r.json()),
    request.get(`${API_BASE}/v1/projects?pageSize=1`, { headers }).then((r) => r.json()),
  ]);
  const created = await request.post(`${API_BASE}/v1/visits/appointments`, {
    headers,
    data: {
      clientId: customers.data[0].id,
      projectId: projects.data[0].id,
      scheduledAt: '2026-12-09T08:00:00.000Z',
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id as string;

  await gotoReady(page, `/dashboard/visits/appointments/${id}`);
  await page.getByRole('button', { name: 'إعادة جدولة' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="scheduledAt"]').fill('2026-12-10T13:00');
  await dialog.getByRole('button', { name: 'إعادة الجدولة' }).click();
  await expect(dialog).toBeHidden();

  // Rescheduling books a new appointment for that day. Cairo is UTC+2 in
  // December: 13:00 there is 11:00 UTC (the old code stored 13:00 UTC).
  await expect
    .poll(async () => {
      const r = await request.get(
        `${API_BASE}/v1/visits/appointments?scheduledFrom=2026-12-10T00:00:00.000Z&scheduledTo=2026-12-11T00:00:00.000Z&pageSize=50`,
        { headers },
      );
      return ((await r.json()).data as Array<{ scheduledAt: string; clientId: string | null }>)
        .filter((a) => a.clientId === customers.data[0].id)
        .map((a) => a.scheduledAt);
    })
    .toContain('2026-12-10T11:00:00.000Z');
});
