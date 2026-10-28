/**
 * MG1 — another system moves a company's data in over the API.
 *
 * - Only the platform owner opens a run; its key is shown once and works only
 *   at its own company's address.
 * - Each list is checked record by record; a dry run keeps nothing; a record
 *   sent again updates what it became.
 * - Units fall into the project's first phase and building when none are
 *   named; a unit sold or booked over there is refused.
 * - Words for stages, activity kinds and call results are recognised; the
 *   rest — and any field with no place here — is kept on the record, and a
 *   lead whose source is not the company's is filed under «نقل بيانات».
 * - Moved-in leads keep their date and send no notifications.
 * - A finished or expired key stops working.
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadStage, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('MG1 — data migration API (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let platformToken: string;
  let adminToken: string;
  let companyId: string;
  let key: string;
  let runId: string;
  let salesEmail: string;
  let slug: string;
  const startedAt = new Date();
  const stamp = Date.now().toString().slice(-7);
  const sys = `mg1-${stamp}`;
  const phone = (n: number) => `+2010${n}${stamp}`;

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const send = (list: string, items: unknown[], opts: { dry?: boolean; k?: string | null; slug?: string } = {}) => {
    const r = http().post(`/v1/migration/${opts.slug ?? slug}/${list}${opts.dry ? '?dryRun=true' : ''}`);
    const k = opts.k === undefined ? key : opts.k;
    return (k ? r.set('X-Migration-Key', k) : r).send({ items });
  };
  const record = (entity: string, externalId: string) =>
    testApp.rawPrisma.migrationRecord.findFirst({ where: { companyId, sourceSystem: sys, entity: entity as never, externalId } });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [platformToken, adminToken] = await Promise.all([
      loginAs(testApp.app, 'platform@example.com', 'PlatformPass1!!'),
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
    ]);
    const admin = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { company: { select: { id: true, slug: true } } },
    });
    companyId = admin.company!.id;
    slug = admin.company!.slug;
    salesEmail = (await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId }, select: { email: true } })).email!;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const records = await raw.migrationRecord.findMany({ where: { companyId, sourceSystem: sys } });
    const ids = (e: string) => records.filter((r) => r.entity === e).map((r) => r.targetId);
    await raw.leadNote.deleteMany({ where: { leadId: { in: ids('LEAD') } } });
    await raw.leadActivity.deleteMany({ where: { leadId: { in: ids('LEAD') } } });
    const leads = await raw.lead.findMany({ where: { id: { in: ids('LEAD') } }, select: { clientId: true } });
    await raw.lead.deleteMany({ where: { id: { in: ids('LEAD') } } });
    await raw.user.deleteMany({
      where: { companyId, role: UserRole.CLIENT, id: { in: [...ids('CUSTOMER'), ...leads.map((l) => l.clientId)] } },
    });
    const projects = ids('PROJECT');
    await raw.unit.deleteMany({ where: { building: { phase: { projectId: { in: projects } } } } });
    await raw.building.deleteMany({ where: { phase: { projectId: { in: projects } } } });
    await raw.phase.deleteMany({ where: { projectId: { in: projects } } });
    await raw.project.deleteMany({ where: { id: { in: projects } } });
    await raw.leadSource.deleteMany({ where: { companyId, name: { path: ['en'], equals: 'Data migration' }, leads: { none: {} } } });
    await raw.migrationRun.deleteMany({ where: { companyId, sourceSystem: { startsWith: 'mg1-' } } });
    await raw.auditLog.deleteMany({ where: { companyId, entityType: 'migration-run', createdAt: { gte: startedAt } } });
  });

  it('MG1-1: only the platform owner opens a run; the key is shown once', async () => {
    await as(adminToken, http().post(`/v1/super-admin/companies/${companyId}/migrations`)).send({ sourceLabel: 'x', sourceSystem: sys }).expect(403);
    const res = (
      await as(platformToken, http().post(`/v1/super-admin/companies/${companyId}/migrations`))
        .send({ sourceLabel: 'نظام تجريبي', sourceSystem: sys, days: 3 })
        .expect(201)
    ).body;
    expect(res.key).toMatch(/^mk_/);
    expect(res.state).toBe('OPEN');
    key = res.key;
    runId = res.id;
    const list = (await as(platformToken, http().get(`/v1/super-admin/companies/${companyId}/migrations`)).expect(200)).body;
    expect(list.companySlug).toBe(slug);
    expect(JSON.stringify(list)).not.toContain(key);
    expect(list.runs.find((r: { id: string }) => r.id === runId).tokenPrefix).toBe(key.slice(0, 9));
    // An Arabic-only name needs the English one.
    await as(platformToken, http().post(`/v1/super-admin/companies/${companyId}/migrations`)).send({ sourceLabel: 'إنجاز' }).expect(400);
  });

  it('MG1-2: the key opens its own company only; a missing or wrong key does not', async () => {
    await send('projects', [{ externalId: 'x', name: 'x' }], { k: null }).expect(401);
    await send('projects', [{ externalId: 'x', name: 'x' }], { k: 'mk_wrong' }).expect(401);
    await send('nothing', [{ externalId: 'x' }]).expect(400);
    await send('projects', [{ externalId: 'x', name: 'x' }], { slug: 'no-such-company-mg1' }).expect(404);
    // Another company's address with this company's key.
    const other = await testApp.rawPrisma.company.findFirst({ where: { id: { not: companyId }, isActive: true }, select: { slug: true } });
    if (other) await send('projects', [{ externalId: 'x', name: 'x' }], { slug: other.slug }).expect(401);
    const status = (await http().get(`/v1/migration/${slug}/status`).set('X-Migration-Key', key).expect(200)).body;
    expect(status.sourceSystem).toBe(sys);
    expect(status.received.PROJECT).toBe(0);
  });

  it('MG1-3: projects — a dry run keeps nothing; sent again, the same project is updated', async () => {
    const items = [
      { externalId: 'p-1', name: 'مشروع الاختبار', city: 'القاهرة', status: 'published' },
      { externalId: 'p-bad' },
    ];
    const dry = (await send('projects', items, { dry: true }).expect(200)).body;
    expect(dry).toMatchObject({ dryRun: true, created: 1, failed: 1 });
    expect(dry.results[1].errors.join(' ')).toContain('name');
    expect(await record('PROJECT', 'p-1')).toBeNull();

    const real = (await send('projects', items).expect(200)).body;
    expect(real.results[0]).toMatchObject({ status: 'created' });
    expect(real.results[0].warnings.join(' ')).toContain('draft');
    const project = await testApp.rawPrisma.project.findUniqueOrThrow({ where: { id: real.results[0].id } });
    expect(project).toMatchObject({ companyId, code: 'P-1', status: 'DRAFT', city: 'القاهرة' });

    const again = (await send('projects', [{ externalId: 'p-1', name: 'مشروع الاختبار ٢' }]).expect(200)).body;
    expect(again.results[0]).toMatchObject({ status: 'updated', id: project.id });
    expect(((await testApp.rawPrisma.project.findUniqueOrThrow({ where: { id: project.id } })).name as { ar: string }).ar).toBe('مشروع الاختبار ٢');
  });

  it('MG1-4: units — first phase and building made; unknown type and fields kept; sold refused', async () => {
    const res = (
      await send('units', [
        { externalId: 'u-1', projectExternalId: 'p-1', code: 'A-101', area: '120', price: 2500000, floor: 3, type: 'نوع غريب', view: 'بحر' },
        { externalId: 'u-2', projectExternalId: 'p-1', code: 'A-102', status: 'مباع' },
        { externalId: 'u-3', projectExternalId: 'p-none', code: 'Z' },
      ]).expect(200)
    ).body;
    expect(res.results[0]).toMatchObject({ status: 'created', kept: { extra: ['view'], unmapped: ['type'] } });
    expect(res.results[1].status).toBe('error');
    expect(res.results[1].errors[0]).toContain('contract');
    expect(res.results[2].errors[0]).toContain('has not been sent');

    const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({
      where: { id: res.results[0].id },
      include: { building: { include: { phase: true } } },
    });
    expect(unit).toMatchObject({ companyId, code: 'A-101', area: 120, floor: 3, status: 'AVAILABLE' });
    expect(Number(unit.price)).toBe(2500000);
    expect(unit.building.phase.name).toMatchObject({ ar: 'المرحلة الأولى' });
    expect(unit.building.totalFloors).toBe(4);
    const rec = await record('UNIT', 'u-1');
    expect(rec!.extra).toEqual({ view: 'بحر' });
    expect(rec!.unmapped).toEqual({ type: 'نوع غريب' });

    // Sent again with the same code: the same unit, no second building.
    const again = (await send('units', [{ externalId: 'u-1', projectExternalId: 'p-1', code: 'A-101', price: 2600000 }]).expect(200)).body;
    expect(again.results[0]).toMatchObject({ status: 'updated', id: unit.id });
    expect((await record('UNIT', 'u-1'))!.unmapped).toBeNull();
    expect(await testApp.rawPrisma.building.count({ where: { phaseId: unit.building.phaseId } })).toBe(1);
  });

  it('MG1-5: customers — their details here, the rest kept; a staff phone is refused', async () => {
    const staffPhone = (await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId }, select: { phone: true } })).phone;
    const res = (
      await send('customers', [
        { externalId: 'c-1', fullName: 'عميل منقول', phone: phone(1), nationalId: '29001011234567', birthDate: '1990-01-01', extra: { 'اسم الزوج': 'فلان' } },
        ...(staffPhone ? [{ externalId: 'c-2', fullName: 'x', phone: staffPhone }] : []),
      ]).expect(200)
    ).body;
    expect(res.results[0]).toMatchObject({ status: 'created', kept: { extra: ['اسم الزوج'] } });
    const user = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: res.results[0].id } });
    expect(user).toMatchObject({ companyId, role: 'CLIENT', nationalId: '29001011234567', phone: phone(1) });
    if (staffPhone) expect(res.results[1].errors[0]).toContain('staff');
  });

  it('MG1-6: leads — stages recognised, the rest kept, dates kept, no notifications', async () => {
    const notificationsBefore = await testApp.rawPrisma.notification.count({ where: { companyId, createdAt: { gte: startedAt } } });
    const res = (
      await send('leads', [
        {
          externalId: 'l-1', fullName: 'عميل منقول', phone: phone(1), stage: 'مهتم', source: 'معرض غير معروف',
          assignedTo: salesEmail, projectExternalId: 'p-1', unitExternalId: 'u-1',
          createdAt: '2025-03-01T10:00:00.000Z', note: 'ملاحظة من النظام القديم', budget: 3000000,
        },
        { externalId: 'l-2', fullName: 'عميل تاني', phone: phone(2), stage: 'مرحلة غريبة', assignedTo: 'nobody@x.com' },
      ]).expect(200)
    ).body;
    expect(res.failed).toBe(0);
    expect(res.results[0].kept).toEqual({ extra: ['budget'], unmapped: ['source'] });
    expect(res.results[1].kept.unmapped.sort()).toEqual(['assignedTo', 'stage']);

    const lead = await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: res.results[0].id }, include: { source: true, notes: true } });
    expect(lead).toMatchObject({ stage: LeadStage.INTERESTED, assignedSalesId: fixtures.userIds.salesId, projectInterestId: (await record('PROJECT', 'p-1'))!.targetId });
    expect(lead.createdAt.toISOString()).toBe('2025-03-01T10:00:00.000Z');
    expect(lead.source!.name).toMatchObject({ ar: 'نقل بيانات' });
    expect(lead.notes).toHaveLength(1);
    // The same person as the moved-in customer.
    expect(lead.clientId).toBe((await record('CUSTOMER', 'c-1'))!.targetId);
    const lead2 = await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: res.results[1].id } });
    expect(lead2).toMatchObject({ stage: LeadStage.NEW, assignedSalesId: null, sourceId: lead.sourceId });

    expect(await testApp.rawPrisma.notification.count({ where: { companyId, createdAt: { gte: startedAt } } })).toBe(notificationsBefore);
  });

  it('MG1-7: activities — kinds and call results recognised; sent again they update', async () => {
    const res = (
      await send('activities', [
        { externalId: 'a-1', leadExternalId: 'l-1', kind: 'مكالمة', callResult: 'لم يرد', text: 'اتصلنا', at: '2025-03-02T09:00:00.000Z', by: salesEmail },
        { externalId: 'a-2', leadExternalId: 'l-none', text: 'x' },
      ]).expect(200)
    ).body;
    expect(res.results[1].errors[0]).toContain('has not been sent');
    const note = await testApp.rawPrisma.leadNote.findUniqueOrThrow({ where: { id: res.results[0].id } });
    expect(note).toMatchObject({ kind: 'CALL', callResult: 'NO_ANSWER', salesId: fixtures.userIds.salesId, body: 'اتصلنا' });
    expect(note.createdAt.toISOString()).toBe('2025-03-02T09:00:00.000Z');

    const again = (await send('activities', [{ externalId: 'a-1', leadExternalId: 'l-1', kind: 'call', callResult: 'answered', text: 'رد' }]).expect(200)).body;
    expect(again.results[0]).toMatchObject({ status: 'updated', id: note.id });
    expect(await testApp.rawPrisma.leadNote.findUniqueOrThrow({ where: { id: note.id } })).toMatchObject({ callResult: 'ANSWERED', body: 'رد' });
  });

  it('MG1-8: the platform owner sees what came in and what is kept; a finished key stops', async () => {
    const list = (await as(platformToken, http().get(`/v1/super-admin/companies/${companyId}/migrations`)).expect(200)).body;
    const run = list.runs.find((r: { id: string }) => r.id === runId);
    expect(run.counts).toMatchObject({ PROJECT: 1, UNIT: 1, CUSTOMER: 1, LEAD: 2, ACTIVITY: 1 });
    expect(run.withUnmapped).toBe(2);
    expect(run.withExtra).toBe(3);
    const kept = (await as(platformToken, http().get(`/v1/super-admin/companies/${companyId}/migrations/${runId}/records?kept=unmapped`)).expect(200)).body;
    expect(kept.map((r: { externalId: string }) => r.externalId).sort()).toEqual(['l-1', 'l-2']);

    await as(platformToken, http().post(`/v1/super-admin/companies/${companyId}/migrations/${runId}/finish`)).expect(200);
    await send('projects', [{ externalId: 'p-2', name: 'x' }]).expect(401);

    // An expired key is refused too.
    const other = (await as(platformToken, http().post(`/v1/super-admin/companies/${companyId}/migrations`)).send({ sourceLabel: 'x', sourceSystem: `${sys}-b` }).expect(201)).body;
    await testApp.rawPrisma.migrationRun.update({ where: { id: other.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await send('projects', [{ externalId: 'p-3', name: 'x' }], { k: other.key }).expect(401);
  });
});
