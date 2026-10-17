/**
 * U5 — the kanban card's "days in stage" and "last contact".
 *
 * - `Lead.stageChangedAt` moves when the stage changes — through the API or
 *   any other write (a DB trigger) — and not when something else changes.
 * - The leads list carries `stageChangedAt` and `lastContactAt` (the latest
 *   note on the lead, null without one).
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadStage, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const DAY = 86_400_000;

describe('U5 — lead stage date and last contact (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let clientId: string;
  let leadId: string;
  const stamp = Date.now().toString().slice(-8);
  const longAgo = new Date(Date.now() - 20 * DAY);

  const http = () => request(testApp.app.getHttpServer());
  const stageChangedAt = async () =>
    (await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { stageChangedAt: true } }))
      .stageChangedAt;
  const listed = async () => {
    const res = await http().get('/v1/leads').query({ q: `U5S ${stamp}`, pageSize: 5 }).set('Authorization', bearer(adminToken)).expect(200);
    return (res.body.data as Array<{ id: string; stageChangedAt: string; lastContactAt: string | null }>).find((l) => l.id === leadId)!;
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    clientId = (
      await raw.user.create({
        data: { companyId, role: UserRole.CLIENT, fullName: `U5S ${stamp}`, phone: `+2025${stamp}`, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    leadId = (
      await raw.lead.create({
        data: {
          companyId, clientId, fullName: `U5S ${stamp}`, phone: `+2025${stamp}`, stage: LeadStage.NEW,
          assignedSalesId: fixtures.userIds.adminId,
        },
        select: { id: true },
      })
    ).id;
    // Pretend the lead has sat in its stage for 20 days.
    await raw.$executeRaw`UPDATE "Lead" SET "stageChangedAt" = ${longAgo} WHERE "id" = ${leadId}::uuid`;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.leadNote.deleteMany({ where: { leadId } });
    await raw.leadActivity.deleteMany({ where: { leadId } });
    await raw.lead.deleteMany({ where: { id: leadId } });
    await raw.user.deleteMany({ where: { id: clientId } });
  });

  it('S-1: other edits leave the stage date alone', async () => {
    await testApp.rawPrisma.lead.update({ where: { id: leadId }, data: { fullName: `U5S ${stamp} edited` } });
    expect((await stageChangedAt()).getTime()).toBe(longAgo.getTime());
    // Writing the same stage again is not a change either.
    await testApp.rawPrisma.lead.update({ where: { id: leadId }, data: { stage: LeadStage.NEW } });
    expect((await stageChangedAt()).getTime()).toBe(longAgo.getTime());
  });

  it('S-2: a stage change through the API moves it to now; the list carries it', async () => {
    const before = Date.now();
    await http()
      .patch(`/v1/leads/${leadId}/stage`)
      .set('Authorization', bearer(adminToken))
      .send({ stage: LeadStage.INTERESTED })
      .expect(200);
    expect((await stageChangedAt()).getTime()).toBeGreaterThanOrEqual(before - 1_000);
    expect(new Date((await listed()).stageChangedAt).getTime()).toBeGreaterThanOrEqual(before - 1_000);
  });

  it('S-3: any other write that changes the stage moves it too', async () => {
    await testApp.rawPrisma.$executeRaw`UPDATE "Lead" SET "stageChangedAt" = ${longAgo} WHERE "id" = ${leadId}::uuid`;
    const before = Date.now();
    await testApp.rawPrisma.lead.updateMany({ where: { id: leadId }, data: { stage: LeadStage.VISIT } });
    expect((await stageChangedAt()).getTime()).toBeGreaterThanOrEqual(before - 1_000);
  });

  it('S-4: last contact is the latest note; none before the first one', async () => {
    expect((await listed()).lastContactAt).toBeNull();
    await http()
      .post(`/v1/leads/${leadId}/notes`)
      .set('Authorization', bearer(adminToken))
      .send({ body: 'Called — wants a visit next week' })
      .expect(201);
    const note = await testApp.rawPrisma.leadNote.findFirstOrThrow({ where: { leadId }, orderBy: { createdAt: 'desc' } });
    expect(new Date((await listed()).lastContactAt!).getTime()).toBe(note.createdAt.getTime());
  });
});
