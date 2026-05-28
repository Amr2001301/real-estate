import { test, expect } from '@playwright/test';
import { loginAsCustomer } from './helpers/auth';

/**
 * Phase 7D — customer-portal cross-app proof for Flows E + F.
 *
 * Logs in as the seeded customer1 ONCE and walks the three account
 * pages. Tests the SURFACE of the data path (page renders + page-
 * specific Arabic heading + no empty-state copy). File downloads are
 * not exercised in the browser — the backend e2e Flow E + F + supervisor
 * specs are the canonical source of truth for the signed-download
 * contract.
 *
 * Single-test design (vs three independent tests with their own
 * `beforeEach`) deliberately keeps us at 1 login per Playwright
 * invocation. The `/v1/auth/customer/login` endpoint shares the same
 * 5-req/min throttle as the staff login — three parallel
 * `loginAsCustomer` calls would trip it (Phase 7B documented the same
 * pattern). One login + three navigations is the small + stable shape.
 *
 * Requires:
 *   - API running, seeded by `prisma:seed:e2e` (creates customer@'s
 *     contract + deposit + maintenance request);
 *   - web-public running on `E2E_BASE_URL` (default :3002);
 *   - matching API + DB topology used by Phase 7A.1 / 7B / 7C.
 */
test.describe('Phase 7D + 7E — customer portal sees the seeded contract / deposit / maintenance and the signed-download UI', () => {
  test('one login → all three pages render + signed-download UI replaces the broken "not available" fallback', async ({ page }) => {
    await loginAsCustomer(page);

    // ── /account/contracts ───────────────────────────────────────────────
    await page.goto('/account/contracts');
    await expect(
      page.getByRole('heading', { name: 'العقود', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/لم نعثر على أي عقود/)).toHaveCount(0);

    // Phase 7E — the customer-facing download button is now a client-
    // component button (NOT an <a href>), and the legacy "العقد غير متاح
    // بعد" fallback must NOT appear for the seeded contract (which has a
    // CUSTOMER_VISIBLE PDF document).
    await expect(
      page.getByRole('button', { name: 'تحميل العقد PDF' }).first(),
      'Phase 7E signed-download button should render on the contract card',
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('العقد غير متاح بعد')).toHaveCount(0);

    // The permanent R2 key must NOT appear anywhere in the rendered DOM.
    // Phase 7D fixed the API to redact `pdfUrl`; Phase 7E fixed the UI to
    // never embed a permanent URL even when it could (now it can't).
    const contractsBody = await page.evaluate(() => document.body.innerText);
    expect(contractsBody).not.toContain('contracts/e2e/customer1-contract.pdf');

    // ── /account/deposits ────────────────────────────────────────────────
    await page.goto('/account/deposits');
    await expect(
      page.getByRole('heading', { name: 'الدفعات', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/لا توجد دفعات/)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'تحميل الإيصال' }).first(),
      'Phase 7E signed-download button should render on the deposit card',
    ).toBeVisible({ timeout: 10_000 });
    // No legacy fallback for receipts either.
    await expect(page.getByText('الإيصال غير متاح بعد')).toHaveCount(0);

    // ── /account/maintenance ─────────────────────────────────────────────
    await page.goto('/account/maintenance');
    await expect(
      page.getByRole('heading', { name: 'الصيانة', level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/لا توجد طلبات صيانة/)).toHaveCount(0);

    // Maintenance per-document signed-download lives on the detail page, not
    // the list. The list page only needs to render — its own assertion above
    // already proves that.
  });
});
