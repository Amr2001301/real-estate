import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/** CAL1 — a follow-up set on a lead shows on its day in the calendar and opens the lead. */
test('a follow-up shows on its day in the calendar and opens the lead', async ({ page, request, context }) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const stamp = Date.now().toString().slice(-8);
  const name = `تقويم ${stamp}`;
  const created = await request.post(`${API_BASE}/v1/leads`, { headers, data: { fullName: name, phone: `+2014${stamp}` } });
  expect(created.ok(), await created.text()).toBe(true);
  const leadId = ((await created.json()) as { id: string }).id;
  const at = new Date(Date.now() + 26 * 60 * 60 * 1000);
  const noted = await request.post(`${API_BASE}/v1/leads/${leadId}/notes`, {
    headers,
    data: { body: 'اتفقنا على اجتماع', kind: 'CALL', callResult: 'ANSWERED', nextActionAt: at.toISOString(), nextActionType: 'MEETING' },
  });
  expect(noted.ok(), await noted.text()).toBe(true);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(at);

  await gotoReady(page, `/dashboard/calendar?month=${day.slice(0, 7)}&day=${day}`);
  const event = page.getByTestId('calendar-day-list').getByTestId('calendar-event').filter({ hasText: name });
  await expect(event).toBeVisible();
  await expect(event).toContainText('اجتماع');
  await event.click();
  await page.waitForURL(new RegExp(`/dashboard/leads/${leadId}`));
});
