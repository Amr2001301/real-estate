import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE } from './global-setup';
import { COMPANY_SLUG } from './helpers/auth';
import { gotoReady } from './helpers/pickers';

test.use({ storageState: ADMIN_STORAGE });

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000';

/**
 * Late fees are charged only on contracts that provide for them: the
 * contract page shows its late-fee clause and the admin turns it on or off
 * as the signed contract says.
 */
test('the admin adds and removes a contract’s late-fee clause', async ({
  page,
  request,
  context,
}) => {
  const token = (await context.cookies()).find((c) => c.name === 'access_token')?.value;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': COMPANY_SLUG };
  const list = await request.get(`${API_BASE}/v1/contracts?q=E2E-CHQ-0001`, { headers });
  const contractId = (await list.json()).data[0].id as string;
  const applies = async () =>
    (await (await request.get(`${API_BASE}/v1/contracts/${contractId}`, { headers })).json())
      .lateFeesApply;

  await gotoReady(page, `/dashboard/contracts/${contractId}`);
  const clause = page.getByTestId('late-fee-clause');
  // The seeded contract has no clause (the default): add it, then remove it.
  await expect(clause).toContainText('لا غرامة تأخير في العقد');
  await clause.getByRole('button', { name: 'إضافة بند الغرامة' }).click();
  await expect(clause).toContainText('العقد ينص على غرامة تأخير');
  expect(await applies()).toBe(true);

  await clause.getByRole('button', { name: 'إزالة بند الغرامة' }).click();
  await expect(clause).toContainText('لا غرامة تأخير في العقد');
  expect(await applies()).toBe(false);
});
