/**
 * AI2 — the AI assistant's API.
 *
 * - Company staff (admin, sales manager, sales) may ask; other roles may not.
 * - Without a configured model the assistant answers 503 and counts nothing
 *   (CI has no ANTHROPIC_API_KEY).
 * - Its read-only tools run against the real schema for every role, inside
 *   the asker's company and scope: a sales rep sees only their own leads,
 *   reservations and visits; the unassigned queue is the managers'.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const TOOLS = [
  'company_overview',
  'list_overdue_installments',
  'search_units',
  'list_leads',
  'list_reservations',
  'upcoming_visits',
];

describe('AI2 — assistant API (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let salesToken: string;
  let supervisorToken: string;
  let companyId: string;
  let packageId: string;

  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [salesToken, supervisorToken] = await Promise.all([
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, 'maintenance@example.com', 'MaintenancePass123!'),
    ]);
    const admin = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } });
    companyId = admin.companyId!;
    const raw = testApp.rawPrisma;
    await raw.companyAiPlan.deleteMany({ where: { companyId } });
    const pkg = await raw.aiPackage.create({ data: { name: `AI2 ${Date.now()}`, questions: 10, price: 100 } });
    packageId = pkg.id;
    await raw.companyAiPlan.create({
      data: {
        companyId,
        packageId,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 20 * 86_400_000),
        quota: 10,
      },
    });
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.companyAiPlan.deleteMany({ where: { companyId } });
    await raw.aiPackage.deleteMany({ where: { id: packageId } });
  });

  it('AI2-1: only company staff may ask; the question is validated', async () => {
    await http().post('/v1/ai/ask').send({ message: 'hi' }).expect(401);
    await http().post('/v1/ai/ask').set('Authorization', bearer(supervisorToken)).send({ message: 'hi' }).expect(403);
    await http().post('/v1/ai/ask').set('Authorization', bearer(salesToken)).send({ message: '' }).expect(400);
  });

  it('AI2-2: without a configured model the assistant answers 503 and counts nothing', async () => {
    const res = await http()
      .post('/v1/ai/ask')
      .set('Authorization', bearer(salesToken))
      .send({ message: 'كم قسط متأخر عندي؟', history: [{ role: 'user', content: 'مرحبا' }, { role: 'assistant', content: 'أهلًا' }] })
      .expect(503);
    expect(res.body.code).toBe('AI_NOT_CONFIGURED');
    const plan = await testApp.rawPrisma.companyAiPlan.findUniqueOrThrow({ where: { companyId } });
    expect(plan.used).toBe(0);
  });

  it.each([UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES])('AI2-3: every tool runs against the schema for %s', async (role) => {
    const userId =
      role === UserRole.ADMIN ? fixtures.userIds.adminId : role === UserRole.SALES ? fixtures.userIds.salesId : fixtures.userIds.managerId;
    for (const name of TOOLS) {
      const out = await testApp.aiTool({ userId, role, companyId }, name, { limit: 5 });
      expect(out).toBeDefined();
      expect((out as { error?: string }).error).toBeUndefined();
    }
  });

  it("AI2-4: a sales rep's tools return only their own work", async () => {
    const raw = testApp.rawPrisma;
    const sales = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId }, select: { fullName: true } });
    const actor = { userId: fixtures.userIds.salesId, role: UserRole.SALES, companyId };

    const leads = (await testApp.aiTool(actor, 'list_leads', { limit: 25, unassigned: true })) as Array<{ rep: string | null }>;
    expect(leads.every((l) => l.rep === sales.fullName)).toBe(true);
    const mine = await raw.lead.count({ where: { companyId, assignedSalesId: fixtures.userIds.salesId } });
    expect(leads.length).toBe(Math.min(mine, 25));

    const reservations = (await testApp.aiTool(actor, 'list_reservations', { limit: 25 })) as Array<{ rep: string | null }>;
    expect(reservations.every((r) => r.rep === sales.fullName)).toBe(true);
  });

  it('AI2-5: a sales manager sees the unassigned queue', async () => {
    const actor = { userId: fixtures.userIds.managerId, role: UserRole.SALES_MANAGER, companyId };
    const leads = (await testApp.aiTool(actor, 'list_leads', { limit: 25, unassigned: true })) as Array<{ rep: string | null }>;
    expect(leads.every((l) => l.rep === null)).toBe(true);
    const unassigned = await testApp.rawPrisma.lead.count({ where: { companyId, assignedSalesId: null } });
    expect(leads.length).toBe(Math.min(unassigned, 25));
  });
});
