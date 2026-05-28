import { test, expect } from '@playwright/test';

/**
 * Flow B — public side of the lead journey proof.
 *
 * Drives the real `<ContactForm>` on `/contact` to submit an info-request
 * (the form's default mode — POST `/v1/public/info-request`) and asserts
 * the user-visible success state. Pair this with
 * `apps/web-admin/e2e/flow-b-admin-sees-lead.spec.ts`, which logs in as
 * admin and confirms the same lead surfaces in `/dashboard/leads`.
 *
 * Cross-app coordination: both specs share the same `name` + `phone`
 * via the `E2E_FLOW_B_NAME` + `E2E_FLOW_B_PHONE` env vars. The Playwright
 * runner injects fresh values per test invocation (see the shared command
 * in `docs/system-qa-strategy.md` §0.2).
 *
 * Requires: API running and seeded by `prisma:seed:e2e` (the form
 * needs `/v1/public/info-request` reachable); web-public running.
 *
 * Selectors are intentionally placeholder/heading-based (Arabic, RTL)
 * because the form has no test-id hooks today; if any selector breaks,
 * back the proof out per the Phase 7B fallback policy in
 * `docs/system-qa-strategy.md` §6 (backend e2e remains the source of truth).
 */
const FORM_NAME = process.env.E2E_FLOW_B_NAME ?? `E2E Flow-B Visitor ${Date.now()}`;
const FORM_PHONE = process.env.E2E_FLOW_B_PHONE ?? `+96650099${String(Date.now()).slice(-4)}`;

test.describe('Flow B — public submits an info-request via /contact', () => {
  test('the contact form posts and the success state appears', async ({ page }) => {
    await page.goto('/contact');
    await expect(
      page.getByRole('heading', { name: 'أرسل استفسارك', level: 2 }),
    ).toBeVisible();

    // Fill the three required fields (Arabic placeholders are stable in this version).
    await page.getByPlaceholder('مثال: محمد الأحمد').fill(FORM_NAME);
    await page.getByPlaceholder('+966 5X XXX XXXX').fill(FORM_PHONE);
    await page.getByPlaceholder('أخبرنا كيف يمكننا مساعدتك...').fill(
      'phase 7b — e2e cross-app proof',
    );

    // Click the submit button (only one on this page).
    await page.getByRole('button', { name: /إرسال|إرسال الطلب/ }).click();

    // The form swaps to a success card on a 2xx response.
    await expect(page.getByText('تم الإرسال بنجاح')).toBeVisible({ timeout: 15_000 });
  });
});
