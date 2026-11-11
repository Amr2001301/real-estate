/**
 * PD1 — a project's page content beyond its description: titled sections,
 * its own FAQ, amenities with an icon and a group (inside / around), and the
 * construction progress by stage. Written by the dashboard, read by the
 * website and the customer app.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';

const t = (ar: string, en = ar) => ({ ar, en });

describe('PD1 — project page details (e2e)', () => {
  let testApp: TestApp;
  let adminToken: string;
  let companyId: string;
  let projectId: string;
  let fixtures: E2EFixtures;
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const patch = (body: object) => asAdmin(http().patch(`/v1/projects/${projectId}`)).send(body);
  const stored = () =>
    testApp.rawPrisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { services: true, amenities: true, progressStages: true, progressUpdatedAt: true },
    });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    companyId = (await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    // Made directly (the demo company is at its plan's project limit); the
    // page content is written through the API.
    const p = await testApp.rawPrisma.project.create({
      data: {
        companyId,
        code: `PD1-${stamp}`,
        name: t('مشروع O7', 'O7'),
        description: t('وصف', 'About'),
        city: 'دمياط الجديدة',
        lat: 31.42,
        lng: 31.81,
        status: 'PUBLISHED',
      },
      select: { id: true },
    });
    projectId = p.id;
  });

  afterAll(async () => {
    await testApp.rawPrisma.project.deleteMany({ where: { id: projectId } });
  });

  it('PD1-1: sections, FAQ, amenities and stages are saved and shown publicly, with the overall progress', async () => {
    await patch({
      sections: [{ title: t('الموقع الاستراتيجي', 'Location'), body: t('دقائق من الطريق الدولي', 'Minutes from the coastal road') }],
      faqs: [{ question: t('أين يقع المشروع؟', 'Where is it?'), answer: t('في دمياط الجديدة', 'In New Damietta') }],
      amenities: [
        { name: t('حمام سباحة', 'Pool'), icon: 'pool', group: 'INSIDE' },
        { name: t('جامعة دمياط', 'Damietta University'), icon: 'university', group: 'AROUND' },
      ],
      progressStages: [
        { name: t('التراخيص', 'Permits'), percent: 100 },
        { name: t('الخرسانات', 'Concrete'), percent: 100 },
        { name: t('الكهروميكانيكال', 'MEP'), percent: 40 },
        { name: t('التسليمات', 'Handover'), percent: 0 },
      ],
    }).expect(200);

    const ar = await http().get(`/v1/public/projects/${projectId}`).expect(200);
    expect(ar.body.sections).toEqual([{ title: 'الموقع الاستراتيجي', body: 'دقائق من الطريق الدولي' }]);
    expect(ar.body.faqs).toEqual([{ question: 'أين يقع المشروع؟', answer: 'في دمياط الجديدة' }]);
    expect(ar.body.amenities).toEqual([
      { name: 'حمام سباحة', icon: 'pool', group: 'INSIDE' },
      { name: 'جامعة دمياط', icon: 'university', group: 'AROUND' },
    ]);
    expect(ar.body.progress).toMatchObject({ overall: 60, stages: [{ name: 'التراخيص', percent: 100 }, {}, {}, {}] });
    expect(typeof ar.body.progress.updatedAt).toBe('string');
    // Older clients still read the names-only `services`.
    expect(ar.body.services).toEqual(['حمام سباحة', 'جامعة دمياط']);

    const en = await http().get(`/v1/public/projects/${projectId}`).set('Accept-Language', 'en').expect(200);
    expect(en.body.sections[0].title).toBe('Location');
  });

  it('PD1-2: an older client writing only `services` keeps each amenity’s icon and group', async () => {
    await patch({ services: [t('حمام سباحة', 'Pool'), t('ملعب أطفال', 'Playground')] }).expect(200);
    const row = await stored();
    expect(row.amenities).toEqual([
      { name: t('حمام سباحة', 'Pool'), icon: 'pool', group: 'INSIDE' },
      { name: t('ملعب أطفال', 'Playground'), icon: 'check', group: 'INSIDE' },
    ]);
  });

  it('PD1-3: «آخر تحديث» moves only when the stages change', async () => {
    const before = (await stored()).progressUpdatedAt!;
    const same = (await stored()).progressStages;
    await patch({ progressStages: same }).expect(200);
    expect((await stored()).progressUpdatedAt).toEqual(before);

    await new Promise((r) => setTimeout(r, 10));
    await patch({ progressStages: [{ name: t('التراخيص', 'Permits'), percent: 100 }] }).expect(200);
    const after = (await stored()).progressUpdatedAt!;
    expect(after.getTime()).toBeGreaterThan(before.getTime());

    // No stages → no progress block on the page.
    await patch({ progressStages: [] }).expect(200);
    const pub = await http().get(`/v1/public/projects/${projectId}`).expect(200);
    expect(pub.body.progress).toBeNull();
  });

  it('PD1-4: an unknown icon or group, or a percent past 100, is refused', async () => {
    await patch({ amenities: [{ name: t('x'), icon: 'rocket', group: 'INSIDE' }] }).expect(400);
    await patch({ amenities: [{ name: t('x'), icon: 'pool', group: 'NEARBY' }] }).expect(400);
    await patch({ progressStages: [{ name: t('x'), percent: 120 }] }).expect(400);
  });

  it('PD1-5: «إشعار الملاك» tells each customer with a signed contract in the project, only when the stages change', async () => {
    // Customer1's signed contract sits in a seeded project.
    const contract = await testApp.rawPrisma.contract.findUniqueOrThrow({
      where: { id: fixtures.flowE.customer1ContractId },
      select: { customerId: true, unit: { select: { building: { select: { phase: { select: { projectId: true } } } } } } },
    });
    const seededProjectId = contract.unit.building.phase.projectId;
    const before = await testApp.rawPrisma.project.findUniqueOrThrow({
      where: { id: seededProjectId },
      select: { progressStages: true, progressUpdatedAt: true },
    });
    const notices = () =>
      testApp.rawPrisma.notification.count({ where: { userId: contract.customerId, templateCode: 'project_progress_customer' } });
    const start = await notices();

    try {
      const res = await asAdmin(http().patch(`/v1/projects/${seededProjectId}`))
        .send({ progressStages: [{ name: t('الحفر', 'Excavation'), percent: 100 }, { name: t('الخرسانات', 'Concrete'), percent: 30 }], notifyOwners: true })
        .expect(200);
      expect(res.body.notifiedOwners).toBeGreaterThanOrEqual(1);
      expect(await notices()).toBe(start + 1);

      // The same stages again: nothing changed, nobody is told twice.
      const again = await asAdmin(http().patch(`/v1/projects/${seededProjectId}`))
        .send({ progressStages: [{ name: t('الحفر', 'Excavation'), percent: 100 }, { name: t('الخرسانات', 'Concrete'), percent: 30 }], notifyOwners: true })
        .expect(200);
      expect(again.body.notifiedOwners).toBe(0);
      // A change without the tick sends nothing either.
      await asAdmin(http().patch(`/v1/projects/${seededProjectId}`))
        .send({ progressStages: [{ name: t('الحفر', 'Excavation'), percent: 100 }, { name: t('الخرسانات', 'Concrete'), percent: 60 }] })
        .expect(200);
      expect(await notices()).toBe(start + 1);
    } finally {
      await testApp.rawPrisma.project.update({
        where: { id: seededProjectId },
        data: { progressStages: before.progressStages ?? [], progressUpdatedAt: before.progressUpdatedAt },
      });
      await testApp.rawPrisma.notification.deleteMany({ where: { userId: contract.customerId, templateCode: 'project_progress_customer' } });
    }
  });
});
