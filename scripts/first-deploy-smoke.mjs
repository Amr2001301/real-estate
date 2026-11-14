#!/usr/bin/env node
// first-deploy-smoke.mjs — the checks to run on a new API (staging, or a
// production platform before its first real company), after
// `pnpm db:deploy` and with SUPER_ADMIN_* set on the API.
//
// It signs in as the platform owner, creates two TEST companies (a developer
// and a brokerage, slugs `<prefix>-dev` / `<prefix>-brk`), signs in as each
// admin, and checks that each reaches its own pages, is refused the other
// type's, cannot read the other company's rows, and that the public catalog
// answers only for a named company.
//
// Usage (secrets stay in the shell, never in a file):
//   API=https://staging-api.example.com/v1 SA_EMAIL=… SA_PASSWORD=… \
//   ADMIN_PW=<a new password for the two test admins> SMOKE_PREFIX=smoke1 \
//   node scripts/first-deploy-smoke.mjs
//
// The two test companies stay; suspend or cancel them from the super-admin
// page afterwards. Use a new SMOKE_PREFIX for each run. Exits non-zero on
// any failed check.

for (const k of ['API', 'SA_EMAIL', 'SA_PASSWORD', 'ADMIN_PW']) {
  if (!process.env[k]) { console.error(`Set ${k}.`); process.exit(2); }
}
const API = process.env.API.replace(/\/$/, '');
const P = process.env.SMOKE_PREFIX ?? 'smoke';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
async function call(method, path, { token, slug, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(slug ? { 'X-Tenant-Slug': slug } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const sa = await call('POST', '/auth/login-super-admin', { body: { email: process.env.SA_EMAIL, password: process.env.SA_PASSWORD } });
check('platform owner signs in', sa.status < 300 && !!sa.data?.tokens?.accessToken, `HTTP ${sa.status}`);
const SA = sa.data?.tokens?.accessToken;

const pw = process.env.ADMIN_PW;
const companies = [
  { name: 'شركة تطوير للتجربة', slug: `${P}-dev`, type: 'DEVELOPER', email: `admin@${P}-dev.test` },
  { name: 'وساطة للتجربة', slug: `${P}-brk`, type: 'BROKERAGE', email: `admin@${P}-brk.test` },
];
for (const c of companies) {
  const r = await call('POST', '/super-admin/companies', { token: SA, body: { name: c.name, slug: c.slug, country: 'EG', type: c.type, adminEmail: c.email, adminPassword: pw, adminFullName: 'مدير ' + c.name } });
  check(`owner creates ${c.type} company`, r.status < 300, `HTTP ${r.status} ${r.status >= 300 ? JSON.stringify(r.data).slice(0, 200) : ''}`);
  const login = await call('POST', '/auth/login-staff', { body: { slug: c.slug, email: c.email, password: pw } });
  c.token = login.data?.tokens?.accessToken;
  check(`${c.type} admin signs in`, !!c.token && login.data?.user?.companyType === c.type, `HTTP ${login.status} type=${login.data?.user?.companyType}`);
}
const [dev, brk] = companies;

// Each reaches its own groups.
for (const c of companies) {
  const lead = await call('POST', '/leads', { token: c.token, slug: c.slug, body: { fullName: 'عميل ' + c.slug, phone: c.type === 'DEVELOPER' ? '01000000001' : '01000000002' } });
  check(`${c.type} creates a lead`, lead.status < 300, `HTTP ${lead.status}`);
  c.leadId = lead.data?.id;
  const perms = await call('GET', '/me/permissions', { token: c.token, slug: c.slug });
  check(`${c.type} reads its own permissions`, perms.status === 200, `HTTP ${perms.status}`);
  const notes = await call('GET', '/me/notifications/unread-count', { token: c.token, slug: c.slug });
  check(`${c.type} reads its notifications count`, notes.status === 200, `HTTP ${notes.status}`);
}
const listing = await call('POST', '/listings', { token: brk.token, slug: brk.slug, body: { kind: 'RESALE', title: 'شقة للتجربة', unitType: '2BR', city: 'القاهرة', area: 120, price: 3000000 } });
check('brokerage creates a listing', listing.status < 300, `HTTP ${listing.status} ${listing.status >= 300 ? JSON.stringify(listing.data).slice(0, 200) : ''}`);
for (const p of ['/deals', '/launches', '/developers', '/deals/targets']) {
  const r = await call('GET', p, { token: brk.token, slug: brk.slug });
  check(`brokerage reaches ${p}`, r.status === 200, `HTTP ${r.status}`);
}
const devProjects = await call('GET', '/projects', { token: dev.token, slug: dev.slug });
check('developer reaches /projects', devProjects.status === 200, `HTTP ${devProjects.status}`);

// Company type walls.
for (const p of ['/contracts', '/projects', '/me/installments']) {
  const r = await call('GET', p, { token: brk.token, slug: brk.slug });
  check(`brokerage refused ${p}`, r.status === 403, `HTTP ${r.status} ${r.data?.code ?? ''}`);
}
for (const p of ['/listings', '/deals', '/launches']) {
  const r = await call('GET', p, { token: dev.token, slug: dev.slug });
  check(`developer refused ${p}`, r.status === 403 && r.data?.code === 'NOT_FOR_DEVELOPER', `HTTP ${r.status} ${r.data?.code ?? ''}`);
}

// Tenant isolation.
const cross = await call('GET', `/leads/${dev.leadId}`, { token: brk.token, slug: brk.slug });
check("brokerage cannot read the developer's lead", cross.status === 404 || cross.status === 403, `HTTP ${cross.status}`);
const spoof = await call('GET', '/leads', { token: brk.token, slug: dev.slug });
const spoofRows = spoof.data?.data ?? [];
check("another company's slug with a brokerage token shows no developer rows", spoof.status >= 400 || !spoofRows.some((l) => l.id === dev.leadId), `HTTP ${spoof.status}`);
const devListing = await call('GET', `/listings/${listing.data?.id}`, { token: dev.token, slug: dev.slug });
check("developer cannot read the brokerage's listing", devListing.status >= 400, `HTTP ${devListing.status}`);

// Public site.
const pub = await call('GET', '/public/projects', { slug: dev.slug });
check('public catalog answers for a named company', pub.status === 200, `HTTP ${pub.status}`);
const anon = await call('GET', '/public/projects');
check('a public request naming no company is refused', anon.status === 503 || anon.status === 400 || anon.status === 404, `HTTP ${anon.status}`);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
