/**
 * BRK-6a — launches and expressions of interest (EOIs).
 *
 * - The admin or a manager opens a launch (from a directory project or a
 *   typed developer) with its EOI amount; a rep does not.
 * - A rep records EOIs for their leads (as themself); one open EOI per lead
 *   and launch; another rep's lead is refused.
 * - A paid EOI takes its place in the queue by payment time; the rep sees
 *   their own EOIs, with their places; the manager the team's.
 * - Allocated: the lead moves to negotiation and the rep is told. Refunded:
 *   only a paid, unallocated EOI. Cancelled: only before payment.
 * - A closed launch takes no EOIs. Another brokerage sees none of it; a
 *   developer company is refused.
 */
import 'reflect-metadata';
import request from 'supertest';
import * as argon2 from 'argon2';
import { CompanyType, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import { seedUnitTypesForCompany } from '../../src/modules/units/unit-type-defaults';

const ROLE_CODES: Record<string, string[]> = {
  ADMIN: [
    'listings:read',
    'listings:manage',
    'deals:read',
    'deals:manage',
    'deals:finance',
    'leads:read',
    'leads:manage',
    'leads:assign',
  ],
  SALES_MANAGER: [
    'listings:read',
    'listings:manage',
    'deals:read',
    'deals:manage',
    'leads:read',
    'leads:manage',
    'leads:assign',
  ],
  SALES: [
    'listings:read',
    'listings:manage',
    'deals:read',
    'deals:manage',
    'leads:read',
    'leads:manage',
  ],
};

describe('BRK-6a — launches and EOIs (e2e)', () => {
  let testApp: TestApp;
  const stamp = Date.now().toString().slice(-7);
  const companyIds: string[] = [];
  type Staff = { id: string; token: string };
  let admin: Staff;
  let manager: Staff;
  let rep: Staff;
  let other: Staff;
  let bAdmin: Staff;
  let devAdmin: string;

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const today = () => new Date().toISOString().slice(0, 10);

  async function brokerage(tag: string) {
    const raw = testApp.rawPrisma;
    const company = await raw.company.create({
      data: {
        name: `BRK6 ${tag} ${stamp}`,
        slug: `brk6-${tag}-${stamp}`,
        type: CompanyType.BROKERAGE,
      },
      select: { id: true },
    });
    companyIds.push(company.id);
    await seedUnitTypesForCompany(raw, company.id);
    const staff = async (role: UserRole, who: string, managerId?: string): Promise<Staff> => {
      const email = `brk6-${tag}-${who}-${stamp}@example.com`;
      const user = await raw.user.create({
        data: {
          companyId: company.id,
          role,
          fullName: `${tag} ${who}`,
          email,
          passwordHash: await argon2.hash('StrongPass1!'),
          locale: 'ar',
          managerId,
        },
        select: { id: true },
      });
      const codes = await raw.permission.findMany({
        where: { code: { in: ROLE_CODES[role] } },
        select: { id: true },
      });
      await raw.userPermission.createMany({
        data: codes.map((p) => ({ userId: user.id, permissionId: p.id })),
        skipDuplicates: true,
      });
      return { id: user.id, token: await loginAs(testApp.app, email, 'StrongPass1!') };
    };
    const a = await staff(UserRole.ADMIN, 'admin');
    const m = await staff(UserRole.SALES_MANAGER, 'manager');
    const r = await staff(UserRole.SALES, 'rep', m.id);
    const o = await staff(UserRole.SALES, 'other');
    return { admin: a, manager: m, rep: r, other: o };
  }

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    ({ admin, manager, rep, other } = await brokerage('a'));
    ({ admin: bAdmin } = await brokerage('b'));
    devAdmin = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.claimPayment.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.developerClaim.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.dealSplit.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.deal.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.launchEoi.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.launch.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.leadRequirement.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.listing.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.developerPlan.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.developerProject.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.brokerDeveloper.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.brokerageTarget.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.commissionRule.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.leadActivity.deleteMany({ where: { lead: { companyId: { in: companyIds } } } });
    await raw.leadNote.deleteMany({ where: { lead: { companyId: { in: companyIds } } } });
    const leadClients = (
      await raw.lead.findMany({
        where: { companyId: { in: companyIds } },
        select: { clientId: true },
      })
    ).map((l) => l.clientId);
    await raw.lead.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.user.deleteMany({ where: { id: { in: leadClients }, role: UserRole.CLIENT } });
    await raw.notification.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.listing.deleteMany({ where: { companyId: { in: companyIds } } });
    const users = await raw.user.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await raw.userPermission.deleteMany({ where: { userId: { in: ids } } });
    await raw.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await raw.authSession.deleteMany({ where: { userId: { in: ids } } });
    await raw.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.user.updateMany({ where: { id: { in: ids } }, data: { managerId: null } });
    await raw.user.deleteMany({ where: { id: { in: ids } } });
    await raw.unitType.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.company.deleteMany({ where: { id: { in: companyIds } } });
  });

  let launchId: string;
  let leadA: string;
  let leadB: string;
  let eoiA: string;
  let eoiB: string;
  let eoiOther: string;

  it('BRK6-1: the admin or a manager opens a launch; a rep does not', async () => {
    await as(rep.token, http().post('/v1/launches'))
      .send({ name: 'إطلاق', developerName: 'مطوّر', launchDate: '2026-12-01', eoiAmount: 100_000 })
      .expect(403);
    await as(manager.token, http().post('/v1/launches'))
      .send({ name: 'بلا مطوّر', launchDate: '2026-12-01', eoiAmount: 100_000 })
      .expect(400);
    const l = await as(manager.token, http().post('/v1/launches'))
      .send({
        name: 'إطلاق المرحلة الثانية',
        developerName: 'ماونتن فيو',
        launchDate: '2026-12-01',
        eoiAmount: 100_000,
      })
      .expect(201);
    launchId = l.body.id;
    expect(l.body).toMatchObject({ status: 'UPCOMING', developerName: 'ماونتن فيو' });
  });

  it('BRK6-2: a rep records EOIs for their own leads, once per lead', async () => {
    const mk = (name: string, phone: string, to: string) =>
      as(admin.token, http().post('/v1/leads'))
        .send({ fullName: name, phone, allowDuplicate: true, assignedSalesId: to })
        .expect(201);
    leadA = (await mk('عميل أول', `0105${stamp}`.slice(0, 11), rep.id)).body.id;
    leadB = (await mk('عميل ثانٍ', `0106${stamp}`.slice(0, 11), rep.id)).body.id;
    const othersLead = (await mk('عميل زميل', `0107${stamp}`.slice(0, 11), other.id)).body.id;

    const a = await as(rep.token, http().post(`/v1/launches/${launchId}/eois`))
      .send({ leadId: leadA, preference: 'شقة 3 غرف', agentId: other.id })
      .expect(201);
    expect(a.body).toMatchObject({
      status: 'PENDING_PAYMENT',
      agentId: rep.id,
      customerName: 'عميل أول',
    });
    expect(Number(a.body.amount)).toBe(100_000);
    eoiA = a.body.id;
    await as(rep.token, http().post(`/v1/launches/${launchId}/eois`))
      .send({ leadId: leadA })
      .expect(409);
    await as(rep.token, http().post(`/v1/launches/${launchId}/eois`))
      .send({ leadId: othersLead })
      .expect(400);
    eoiB = (
      await as(rep.token, http().post(`/v1/launches/${launchId}/eois`))
        .send({ leadId: leadB })
        .expect(201)
    ).body.id;
    eoiOther = (
      await as(other.token, http().post(`/v1/launches/${launchId}/eois`))
        .send({ customerName: 'عميل مباشر', customerPhone: '01012345678' })
        .expect(201)
    ).body.id;
  });

  it('BRK6-3: paid EOIs queue by payment time; each sees their own', async () => {
    await as(rep.token, http().post(`/v1/launches/eois/${eoiB}/pay`))
      .send({})
      .expect(403);
    await as(manager.token, http().post(`/v1/launches/eois/${eoiOther}/pay`))
      .send({})
      .expect(404); // not the manager's team
    await as(admin.token, http().post(`/v1/launches/eois/${eoiOther}/pay`))
      .send({ paidAt: '2026-11-10T09:00:00.000Z' })
      .expect(201);
    await as(manager.token, http().post(`/v1/launches/eois/${eoiB}/pay`))
      .send({ paidAt: '2026-11-11T09:00:00.000Z', paymentRef: 'TRX-22' })
      .expect(201);
    await as(manager.token, http().post(`/v1/launches/eois/${eoiA}/pay`))
      .send({ paidAt: '2026-11-12T09:00:00.000Z' })
      .expect(201);
    await as(manager.token, http().post(`/v1/launches/eois/${eoiA}/pay`))
      .send({})
      .expect(409);

    const mine = await as(rep.token, http().get(`/v1/launches/${launchId}`)).expect(200);
    expect(mine.body.queueLength).toBe(3);
    expect(mine.body.eois.map((e: { id: string; queue: number }) => [e.id, e.queue])).toEqual([
      [eoiB, 2],
      [eoiA, 3],
    ]);
    const list = await as(admin.token, http().get('/v1/launches')).expect(200);
    expect(list.body.find((l: { id: string }) => l.id === launchId)).toMatchObject({
      counts: { total: 3, pending: 0, paid: 3, allocated: 0, refunded: 0 },
      held: 300_000,
    });
  });

  it('BRK6-4: allocate moves the lead on and tells the rep; refund only a paid EOI; cancel only before payment', async () => {
    await as(manager.token, http().post(`/v1/launches/eois/${eoiB}/allocate`))
      .send({ allocation: 'شقة B-204، الدور الثاني' })
      .expect(201);
    expect((await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: leadB } })).stage).toBe(
      'NEGOTIATION',
    );
    expect(
      await testApp.rawPrisma.notification.count({
        where: { userId: rep.id, templateCode: 'eoi_allocated' },
      }),
    ).toBe(1);
    await as(manager.token, http().post(`/v1/launches/eois/${eoiB}/refund`)).expect(409);
    await as(manager.token, http().post(`/v1/launches/eois/${eoiA}/refund`)).expect(201);
    await as(rep.token, http().post(`/v1/launches/eois/${eoiA}/cancel`)).expect(409);

    const mine = await as(rep.token, http().get(`/v1/launches/${launchId}`)).expect(200);
    expect(mine.body.queueLength).toBe(2);
    expect(mine.body.eois.map((e: { status: string }) => e.status)).toEqual([
      'ALLOCATED',
      'REFUNDED',
    ]);
  });

  it('BRK6-5: a closed launch takes no EOIs; another brokerage and a developer company are refused', async () => {
    await as(manager.token, http().patch(`/v1/launches/${launchId}`))
      .send({ status: 'CLOSED' })
      .expect(200);
    await as(rep.token, http().post(`/v1/launches/${launchId}/eois`))
      .send({ customerName: 'متأخر', customerPhone: '01098765432' })
      .expect(409);
    const b = await as(bAdmin.token, http().get('/v1/launches')).expect(200);
    expect(b.body).toEqual([]);
    await as(bAdmin.token, http().get(`/v1/launches/${launchId}`)).expect(404);
    await as(bAdmin.token, http().post(`/v1/launches/eois/${eoiOther}/refund`)).expect(404);
    const dev = await as(devAdmin, http().get('/v1/launches')).expect(403);
    expect(JSON.stringify(dev.body)).toContain('NOT_FOR_DEVELOPER');
  });
});
