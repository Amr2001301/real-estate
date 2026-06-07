import { chromium } from 'playwright';
const BASE = 'http://localhost:3001';

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill('admin@local.test');
  await page.locator('input[type="password"]').first().fill('Admin12345!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // 1. Pagination pill — installments has many pages
  await page.goto(`${BASE}/dashboard/installments`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const pag = page.locator('nav[aria-label="pagination"]');
  if (await pag.count()) {
    const pb = await pag.boundingBox();
    await page.screenshot({ path: '/tmp/h01_pagination.png', clip: { x: pb.x - 10, y: pb.y - 10, width: pb.width + 20, height: pb.height + 20 } });
    console.log('✓ h01 pagination');
  } else {
    await page.screenshot({ path: '/tmp/h01_installments.png' });
    console.log('✓ h01 installments (no pagination)');
  }

  // 2. Leads CRM pipeline board
  await page.goto(`${BASE}/dashboard/leads`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: '/tmp/h02_leads.png' });
  console.log('✓ h02 leads');

  // 3. Outline button hover — units page "فلاتر متقدمة"
  await page.goto(`${BASE}/dashboard/units`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // find outline button
  const outlineBtn = page.locator('button').filter({ hasText: /فلاتر|تصدير|CSV/ }).first();
  if (await outlineBtn.count()) {
    const ob = await outlineBtn.boundingBox();
    await outlineBtn.hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '/tmp/h03_outline_hover.png', clip: { x: Math.max(0, ob.x - 20), y: Math.max(0, ob.y - 20), width: Math.min(400, ob.width + 40), height: ob.height + 40 } });
    console.log('✓ h03 outline hover');
  }

  // 4. Primary button close-up — units "إضافة وحدة جديدة"
  const primaryBtn = page.locator('button').filter({ hasText: /إضافة|جديد/ }).first();
  if (await primaryBtn.count()) {
    const pb2 = await primaryBtn.boundingBox();
    await page.screenshot({ path: '/tmp/h04_primary_btn.png', clip: { x: Math.max(0, pb2.x - 10), y: Math.max(0, pb2.y - 10), width: pb2.width + 20, height: pb2.height + 20 } });
    console.log('✓ h04 primary button');
  }

  // 5. Mobile 390px — units table (responsive)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/dashboard/units`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/h05_mobile_units.png' });
  console.log('✓ h05 mobile units');

  // 6. Tablet 768px — dashboard  
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/h06_tablet_dash.png' });
  console.log('✓ h06 tablet dashboard');

  await browser.close();
  console.log('Done h-series');
}
run().catch(e => { console.error(e.message); process.exit(1); });
