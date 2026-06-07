import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const EMAIL = 'admin@local.test';
const PASS = 'Admin12345!';

async function shot(page, path, full = false) {
  await page.screenshot({ path, fullPage: full });
  console.log('✓', path);
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login
  await goto(page, `${BASE}/login`);
  await page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]').first().fill(EMAIL).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PASS).catch(() => {});
  await page.locator('button[type="submit"]').click().catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, '/tmp/qa_01_after_login.png');

  // Main dashboard KPI + charts
  await goto(page, `${BASE}/dashboard`);
  await shot(page, '/tmp/qa_02_dashboard_viewport.png');
  await shot(page, '/tmp/qa_03_dashboard_full.png', true);

  // Units — table + filter bar + status badges
  await goto(page, `${BASE}/dashboard/units`);
  await shot(page, '/tmp/qa_04_units.png', true);

  // Clients — table + filter
  await goto(page, `${BASE}/dashboard/clients`);
  await shot(page, '/tmp/qa_05_clients.png', true);

  // Contracts — badges
  await goto(page, `${BASE}/dashboard/contracts`);
  await shot(page, '/tmp/qa_06_contracts.png', true);

  // Leads — CRM pipeline + badges
  await goto(page, `${BASE}/dashboard/leads`);
  await shot(page, '/tmp/qa_07_leads.png', true);

  // Reservations — many badge states
  await goto(page, `${BASE}/dashboard/reservations`);
  await shot(page, '/tmp/qa_08_reservations.png', true);

  // Visits — appointment badges
  await goto(page, `${BASE}/dashboard/visits`);
  await shot(page, '/tmp/qa_09_visits.png', true);

  // Brokers
  await goto(page, `${BASE}/dashboard/brokers`);
  await shot(page, '/tmp/qa_10_brokers.png', true);

  // Row hover state
  await goto(page, `${BASE}/dashboard/units`);
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.count()) { await firstRow.hover(); await page.waitForTimeout(350); }
  await shot(page, '/tmp/qa_11_row_hover.png');

  // Input focus state
  await goto(page, `${BASE}/dashboard/clients`);
  await page.locator('input:visible').first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(250);
  await shot(page, '/tmp/qa_12_input_focus.png');

  // Form page (inputs/selects/labels)
  await goto(page, `${BASE}/dashboard/clients/new`);
  await shot(page, '/tmp/qa_13_client_form.png', true);

  // Pagination (installments has many rows)
  await goto(page, `${BASE}/dashboard/installments`);
  await shot(page, '/tmp/qa_14_installments.png', true);

  // Tablet 768
  await page.setViewportSize({ width: 768, height: 1024 });
  await goto(page, `${BASE}/dashboard`);
  await shot(page, '/tmp/qa_15_tablet.png');
  await goto(page, `${BASE}/dashboard/units`);
  await shot(page, '/tmp/qa_16_tablet_table.png', true);

  // Mobile 390
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, `${BASE}/dashboard`);
  await shot(page, '/tmp/qa_17_mobile.png');

  await browser.close();
  console.log('All done');
}

run().catch(e => { console.error(e.message); process.exit(1); });
