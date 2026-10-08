import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Helpers for driving SearchSelect pickers (components/form/search-select.tsx).
 *
 * The pickers live in client components. An interaction that lands before
 * React hydrates the page is lost — a focus with no onFocus attached yet, a
 * typed value reset by hydration, a <select> change nobody heard — so pages
 * are opened with `gotoReady` and lists are opened with a retry.
 */

export const UUID = /^[0-9a-f-]{36}$/;

/** The open SearchSelect's options. A bare getByRole('option') would also
 *  match the <option>s of the page's native <select>s. */
export const options = (page: Page): Locator => page.getByRole('listbox').getByRole('option');

/** Navigate and wait until the page's scripts have loaded (hydrated). */
export async function gotoReady(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' });
}

/** Run `open` until the list shows an option (matching `text`, if given). */
async function openList(
  page: Page,
  open: () => Promise<void>,
  text?: string | RegExp,
): Promise<Locator> {
  const option = text ? options(page).filter({ hasText: text }).first() : options(page).first();
  await expect(async () => {
    await open();
    await expect(option).toBeVisible({ timeout: 2_000 });
  }, 'did you run prisma:seed:e2e against the API DB?').toPass({ timeout: 15_000 });
  return option;
}

/** Type `query` into the picker `#field` and pick the first option matching `text`. */
export async function pick(
  page: Page,
  field: string,
  query: string,
  text: string | RegExp,
): Promise<Locator> {
  // The <Field> label names the combobox (htmlFor = id = field name).
  const input = page.locator(`#${field}`);
  const option = await openList(page, () => input.fill(query, { timeout: 2_000 }), text);
  await option.click();
  await expect(page.locator(`input[name="${field}"]`)).toHaveValue(UUID);
  return option;
}

/** Open the picker `#field` without typing and pick its first option. Returns its label. */
export async function pickFirst(page: Page, field: string): Promise<string> {
  const input = page.locator(`#${field}`);
  const option = await openList(page, () => input.click({ timeout: 2_000 }));
  const label = (await option.innerText()).trim();
  await option.click();
  await expect(page.locator(`input[name="${field}"]`)).toHaveValue(UUID);
  return label;
}
