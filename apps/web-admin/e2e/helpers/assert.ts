import { expect, type Page } from '@playwright/test';

export interface RouteCheck {
  path: string;
  /** A stable Arabic substring/regex that appears on the loaded page. */
  heading: string | RegExp;
}

/** No Next.js global error overlay / crash text anywhere on the page. */
export async function assertNoErrorOverlay(page: Page): Promise<void> {
  await expect(
    page.getByText(/Application error|Internal Server Error|something went wrong/i),
  ).toHaveCount(0);
}

/**
 * Navigate to a route and assert it (a) did not bounce to /login, (b) stayed on
 * the requested path, (c) rendered its route-specific heading (not an error
 * boundary), and (d) shows no crash overlay. Data-independent — empty states are
 * acceptable because we only assert the shell + heading, never row counts.
 */
export async function assertRouteLoads(page: Page, route: RouteCheck): Promise<void> {
  await page.goto(route.path);
  await expect(page).not.toHaveURL(/\/login(\?|$)/);
  expect(new URL(page.url()).pathname).toBe(route.path);
  await expect(page.getByText(route.heading).first()).toBeVisible();
  await assertNoErrorOverlay(page);
}

/** Assert each admin-only sidebar link is absent for the current role. */
export async function assertNavLinksHidden(page: Page, labels: string[]): Promise<void> {
  for (const label of labels) {
    await expect(
      page.getByRole('link', { name: label, exact: true }),
      `nav link "${label}" should be hidden for this role`,
    ).toHaveCount(0);
  }
}

/** Admin-only nav labels that no sales role should ever see. */
export const ADMIN_ONLY_NAV_LABELS = [
  'المستخدمون',
  'الصلاحيات',
  'الإعدادات',
  'سجلات التدقيق',
];
