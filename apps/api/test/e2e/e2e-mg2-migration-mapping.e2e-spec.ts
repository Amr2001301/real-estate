/**
 * MG2 — the platform owner maps what a migration kept.
 *
 * - The screen lists, per system, each kept value (a stage, a source, a
 *   person, an activity kind…) and each extra field, with how many records
 *   carry it; only the platform owner opens it.
 * - A choice is saved and applied to the records already moved — but only
 *   to a record still holding what the move put there (owner, 2026-10-30):
 *   a lead someone moved on by hand stays.
 * - A stage / kind choice holds for the whole system; a source / person
 *   choice for the company.
 * - Extra fields: a lead's can become a note (written once), a customer's one
 *   of the company's customer fields (where the customer has none yet).
 * - Later sends use the choices directly.
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadNoteKind, LeadStage, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('MG2 — mapping what a migration kept (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let platformToken: string;
  let adminToken: string;
  let companyId: string;
  let slug: string;
  let key: string;
  let sourceId: string;
  const startedAt = new Date();
  const stamp = Date.now().toString().slice(-7);
  const sys = `mg2-${stamp}`;
  const fieldKey = `mg2_gov_${stamp}`;
  const phone = (n: number) => `+2011${n}${stamp}`;

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const base = () => `/v1/super-admin/companies/${companyId}/migrations/mapping`;
  const send = (list: string, items: unknown[]) =>
    http()
      .post(`/v1/migration/${slug}/${list}`)
      .set('X-Migration-Key', key)
      .send({ items })
      .expect(200);
  const save = (body: Record<string, unknown>) =>
    as(platformToken, http().put(base())).send({ sourceSystem: sys, ...body });
  const targetOf = async (entity: string, externalId: string) =>
    (
      await testApp.rawPrisma.migrationRecord.findFirstOrThrow({
        where: { companyId, sourceSystem: sys, entity: entity as never, externalId },
      })
    ).targetId;

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
    sourceId = (
      await testApp.rawPrisma.leadSource.findFirstOrThrow({
        where: {
          companyId,
          active: true,
          NOT: { name: { path: ['en'], equals: 'Data migration' } },
        },
        select: { id: true },
      })
    ).id;
    await testApp.rawPrisma.customerField.create({
      data: {
        companyId,
        key: fieldKey,
        label: { ar: 'المحافظة', en: 'Governorate' },
        type: 'TEXT',
      },
    });
    key = (
      await as(platformToken, http().post(`/v1/super-admin/companies/${companyId}/migrations`))
        .send({ sourceLabel: 'نظام ربط', sourceSystem: sys })
        .expect(201)
    ).body.key;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const records = await raw.migrationRecord.findMany({ where: { companyId, sourceSystem: sys } });
    const ids = (e: string) => records.filter((r) => r.entity === e).map((r) => r.targetId);
    await raw.leadNote.deleteMany({ where: { leadId: { in: ids('LEAD') } } });
    await raw.leadActivity.deleteMany({ where: { leadId: { in: ids('LEAD') } } });
    const leads = await raw.lead.findMany({
      where: { id: { in: ids('LEAD') } },
      select: { clientId: true },
    });
    await raw.lead.deleteMany({ where: { id: { in: ids('LEAD') } } });
    await raw.user.deleteMany({
      where: {
        companyId,
        role: UserRole.CLIENT,
        id: { in: [...ids('CUSTOMER'), ...leads.map((l) => l.clientId)] },
      },
    });
    await raw.leadSource.deleteMany({
      where: { companyId, name: { path: ['en'], equals: 'Data migration' }, leads: { none: {} } },
    });
    await raw.migrationMapping.deleteMany({ where: { sourceSystem: sys } });
    await raw.migrationRun.deleteMany({ where: { companyId, sourceSystem: sys } });
    await raw.customerField.deleteMany({ where: { companyId, key: fieldKey } });
    await raw.auditLog.deleteMany({
      where: {
        companyId,
        entityType: { in: ['migration-run', 'migration-mapping'] },
        createdAt: { gte: startedAt },
      },
    });
  });

  it('MG2-1: the screen lists what was kept, by system; only the platform owner opens it', async () => {
    await send('customers', [
      { externalId: 'c-1', fullName: 'عميل ربط', phone: phone(1), المحافظة: 'القاهرة' },
    ]);
    await send('leads', [
      {
        externalId: 'l-1',
        fullName: 'فرصة ١',
        phone: phone(2),
        stage: 'مهتم جداً',
        source: 'فيسبوك إعلانات',
        assignedTo: 'old@other.com',
        'اسم الزوج': 'محمد',
      },
      {
        externalId: 'l-2',
        fullName: 'فرصة ٢',
        phone: phone(3),
        stage: 'مهتم جدا',
        source: 'فيسبوك إعلانات',
        assignedTo: 'old@other.com',
      },
    ]);
    await send('activities', [
      { externalId: 'a-1', leadExternalId: 'l-1', kind: 'رسالة نصية', text: 'كلمته' },
    ]);
    // Someone moves lead 2 on by hand after the move.
    await testApp.rawPrisma.lead.update({
      where: { id: await targetOf('LEAD', 'l-2') },
      data: { stage: LeadStage.VISIT },
    });

    await as(adminToken, http().get(base())).expect(403);
    const screen = (await as(platformToken, http().get(`${base()}?system=${sys}`)).expect(200))
      .body;
    expect(screen.sourceSystem).toBe(sys);
    const group = (field: string) =>
      screen.groups.find((g: { field: string }) => g.field === field);
    // «مهتم جداً» and «مهتم جدا» are one value.
    expect(group('LEAD.stage')).toMatchObject({ count: 2, mapping: null });
    expect(group('LEAD.source')).toMatchObject({ count: 2 });
    expect(group('LEAD.assignedTo')).toMatchObject({ count: 2 });
    expect(group('ACTIVITY.kind')).toMatchObject({ count: 1 });
    expect(group('LEAD.extra.اسم الزوج')).toMatchObject({ count: 1, sample: 'محمد' });
    expect(group('CUSTOMER.extra.المحافظة')).toMatchObject({ count: 1 });
    expect(screen.options.stages).toContain('INTERESTED');
    expect(screen.options.sources.map((s: { id: string }) => s.id)).toContain(sourceId);
    expect(screen.options.customerFields.map((f: { key: string }) => f.key)).toContain(fieldKey);
  });

  it('MG2-2: a choice applies to what was moved — never over a hand change; a stage holds for the whole system', async () => {
    const stage = (
      await save({
        field: 'LEAD.stage',
        value: 'مهتم جدا',
        action: 'MAP',
        target: 'INTERESTED',
      }).expect(200)
    ).body;
    expect(stage).toEqual({ applied: 1, kept: 1 });
    expect(
      (
        await testApp.rawPrisma.lead.findUniqueOrThrow({
          where: { id: await targetOf('LEAD', 'l-1') },
        })
      ).stage,
    ).toBe(LeadStage.INTERESTED);
    expect(
      (
        await testApp.rawPrisma.lead.findUniqueOrThrow({
          where: { id: await targetOf('LEAD', 'l-2') },
        })
      ).stage,
    ).toBe(LeadStage.VISIT);
    const row = await testApp.rawPrisma.migrationMapping.findFirstOrThrow({
      where: { sourceSystem: sys, field: 'LEAD.stage' },
    });
    expect(row.companyId).toBeNull();

    expect(
      (
        await save({
          field: 'LEAD.source',
          value: 'فيسبوك إعلانات',
          action: 'MAP',
          target: sourceId,
        }).expect(200)
      ).body,
    ).toEqual({ applied: 2, kept: 0 });
    expect(
      (
        await save({
          field: 'LEAD.assignedTo',
          value: 'old@other.com',
          action: 'MAP',
          target: fixtures.userIds.salesId,
        }).expect(200)
      ).body,
    ).toEqual({ applied: 2, kept: 0 });
    expect(
      (
        await save({
          field: 'ACTIVITY.kind',
          value: 'رسالة نصية',
          action: 'MAP',
          target: 'WHATSAPP',
        }).expect(200)
      ).body,
    ).toEqual({ applied: 1, kept: 0 });
    const lead1 = await testApp.rawPrisma.lead.findUniqueOrThrow({
      where: { id: await targetOf('LEAD', 'l-1') },
    });
    expect(lead1).toMatchObject({ sourceId, assignedSalesId: fixtures.userIds.salesId });
    expect(
      (
        await testApp.rawPrisma.leadNote.findUniqueOrThrow({
          where: { id: await targetOf('ACTIVITY', 'a-1') },
        })
      ).kind,
    ).toBe(LeadNoteKind.WHATSAPP);

    // Saved again: nothing more changes.
    expect(
      (
        await save({
          field: 'LEAD.stage',
          value: 'مهتم جداً',
          action: 'MAP',
          target: 'INTERESTED',
        }).expect(200)
      ).body,
    ).toEqual({ applied: 0, kept: 2 });
    const screen = (await as(platformToken, http().get(`${base()}?system=${sys}`)).expect(200))
      .body;
    expect(
      screen.groups.find((g: { field: string }) => g.field === 'LEAD.stage').mapping,
    ).toMatchObject({ action: 'MAP', target: 'INTERESTED', systemWide: true });
  });

  it('MG2-3: extra fields — a lead’s into a note once, a customer’s into a customer field', async () => {
    const field = 'LEAD.extra.اسم الزوج';
    expect((await save({ field, action: 'NOTE' }).expect(200)).body).toEqual({
      applied: 1,
      kept: 0,
    });
    expect((await save({ field, action: 'NOTE' }).expect(200)).body).toEqual({
      applied: 0,
      kept: 1,
    });
    const notes = await testApp.rawPrisma.leadNote.findMany({
      where: { leadId: await targetOf('LEAD', 'l-1'), body: 'اسم الزوج: محمد' },
    });
    expect(notes).toHaveLength(1);

    expect(
      (
        await save({
          field: 'CUSTOMER.extra.المحافظة',
          action: 'CUSTOMER_FIELD',
          target: fieldKey,
        }).expect(200)
      ).body,
    ).toEqual({ applied: 1, kept: 0 });
    const customer = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: await targetOf('CUSTOMER', 'c-1') },
    });
    expect(customer.customFields).toMatchObject({ [fieldKey]: 'القاهرة' });
  });

  it('MG2-4: a choice must be one of the company’s; an extra field elsewhere can only be ignored', async () => {
    await save({ field: 'LEAD.stage', value: 'x', action: 'MAP', target: 'BOGUS' }).expect(400);
    await save({
      field: 'LEAD.source',
      value: 'x',
      action: 'MAP',
      target: '00000000-0000-0000-0000-000000000000',
    }).expect(400);
    await save({ field: 'PROJECT.extra.notes', action: 'NOTE' }).expect(400);
    await save({
      field: 'CUSTOMER.extra.المحافظة',
      action: 'CUSTOMER_FIELD',
      target: 'no_such_field',
    }).expect(400);
    await as(platformToken, http().put(base()))
      .send({ sourceSystem: 'never-moved', field: 'LEAD.stage', value: 'x', action: 'IGNORE' })
      .expect(404);
    await as(adminToken, http().put(base()))
      .send({ sourceSystem: sys, field: 'LEAD.stage', value: 'x', action: 'IGNORE' })
      .expect(403);
  });

  it('MG2-5: later sends use the choices directly', async () => {
    await send('customers', [
      { externalId: 'c-2', fullName: 'عميل ربط ٢', phone: phone(4), المحافظة: 'الجيزة' },
    ]);
    const res = (
      await send('leads', [
        {
          externalId: 'l-3',
          fullName: 'فرصة ٣',
          phone: phone(5),
          stage: 'مهتم جداً',
          source: 'فيسبوك إعلانات',
          assignedTo: 'old@other.com',
          'اسم الزوج': 'علي',
        },
      ])
    ).body;
    // Still kept on the record: these are not words the format knows.
    expect(res.results[0].kept.unmapped.sort()).toEqual(['assignedTo', 'source', 'stage']);
    const lead = await testApp.rawPrisma.lead.findUniqueOrThrow({
      where: { id: res.results[0].id },
      include: { notes: true },
    });
    expect(lead).toMatchObject({
      stage: LeadStage.INTERESTED,
      sourceId,
      assignedSalesId: fixtures.userIds.salesId,
    });
    expect(lead.notes.map((n) => n.body)).toContain('اسم الزوج: علي');
    const customer = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: await targetOf('CUSTOMER', 'c-2') },
    });
    expect(customer.customFields).toMatchObject({ [fieldKey]: 'الجيزة' });

    const act = (
      await send('activities', [
        { externalId: 'a-2', leadExternalId: 'l-3', kind: 'رسالة نصية', text: 'تاني' },
      ])
    ).body;
    expect(
      (await testApp.rawPrisma.leadNote.findUniqueOrThrow({ where: { id: act.results[0].id } }))
        .kind,
    ).toBe(LeadNoteKind.WHATSAPP);
  });
});
