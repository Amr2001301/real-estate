/**
 * BRK-5 — a brokerage's developer directory, payment-plan comparison, lead
 * requirements and matching, and lead distribution.
 *
 * - The admin keeps developers, their projects and plans; names are unique;
 *   a plan's shares must leave something to pay (or be all cash); a rep
 *   reads and compares but does not edit.
 * - Plans compare on one price: down payment, instalments, monthly, cash.
 * - A primary listing filed under a project takes its developer and project
 *   names; a resale cannot be; a project with listings is not deleted.
 * - A rep records what their lead wants; the listings that fit come back
 *   scored; a listing shows the rep's leads it fits; a new listing that fits
 *   tells the rep. Another rep does not reach the lead.
 * - The manager distributes the unassigned leads to the team, fewest open
 *   leads first; each rep is told once; not to someone outside the team.
 * - Another brokerage sees none of it; a developer company is refused.
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

describe('BRK-5 — developer directory, matching and distribution (e2e)', () => {
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
        name: `BRK5 ${tag} ${stamp}`,
        slug: `brk5-${tag}-${stamp}`,
        type: CompanyType.BROKERAGE,
      },
      select: { id: true },
    });
    companyIds.push(company.id);
    await seedUnitTypesForCompany(raw, company.id);
    const staff = async (role: UserRole, who: string, managerId?: string): Promise<Staff> => {
      const email = `brk5-${tag}-${who}-${stamp}@example.com`;
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

  let developerId: string;
  let projectId: string;
  let planA: string;
  let planCash: string;
  let leadId: string;

  it('BRK5-1: the admin keeps developers, projects and plans; a rep only reads', async () => {
    const dev = await as(admin.token, http().post('/v1/developers'))
      .send({
        name: 'ماونتن فيو',
        contactName: 'مسؤول المبيعات',
        phone: '01001234567',
        defaultCommissionPct: 3,
      })
      .expect(201);
    developerId = dev.body.id;
    await as(admin.token, http().post('/v1/developers')).send({ name: 'ماونتن فيو' }).expect(409);
    await as(rep.token, http().post('/v1/developers')).send({ name: 'مطوّر آخر' }).expect(403);
    const project = await as(manager.token, http().post(`/v1/developers/${developerId}/projects`))
      .send({ name: 'آي سيتي', city: 'القاهرة الجديدة', commissionPct: 3.5 })
      .expect(201);
    projectId = project.body.id;
    const a = await as(admin.token, http().post(`/v1/developers/projects/${projectId}/plans`))
      .send({
        name: '10% على 8 سنين',
        downPaymentPct: 10,
        years: 8,
        frequency: 'QUARTERLY',
        deliveryPct: 5,
      })
      .expect(201);
    planA = a.body.id;
    const cash = await as(admin.token, http().post(`/v1/developers/projects/${projectId}/plans`))
      .send({ name: 'كاش', downPaymentPct: 100, years: 0, cashDiscountPct: 12 })
      .expect(201);
    planCash = cash.body.id;
    await as(admin.token, http().post(`/v1/developers/projects/${projectId}/plans`))
      .send({ name: 'خطأ', downPaymentPct: 60, years: 5, deliveryPct: 40 })
      .expect(400);

    const list = await as(rep.token, http().get('/v1/developers')).expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({
        name: 'ماونتن فيو',
        projects: [expect.objectContaining({ name: 'آي سيتي', _count: { plans: 2, listings: 0 } })],
      }),
    ]);
    const options = await as(rep.token, http().get('/v1/developers/projects/options')).expect(200);
    expect(options.body).toEqual([
      expect.objectContaining({
        id: projectId,
        commissionPct: 3.5,
        developer: expect.objectContaining({ name: 'ماونتن فيو' }),
      }),
    ]);
  });

  it('BRK5-2: plans compare on one price', async () => {
    const r = await as(rep.token, http().post('/v1/developers/plans/compare'))
      .send({ price: 8_000_000, planIds: [planA, planCash] })
      .expect(201);
    expect(r.body.plans.map((p: { breakdown: unknown }) => p.breakdown)).toEqual([
      {
        total: 8_000_000,
        downPayment: 800_000,
        deliveryPayment: 400_000,
        installments: 32,
        installment: 212_500,
        monthly: 70_833.33,
        cash: false,
      },
      {
        total: 7_040_000,
        downPayment: 7_040_000,
        deliveryPayment: 0,
        installments: 0,
        installment: 0,
        monthly: 0,
        cash: true,
      },
    ]);
    await as(bAdmin.token, http().post('/v1/developers/plans/compare'))
      .send({ price: 1, planIds: [planA] })
      .expect(404);
  });

  it('BRK5-3: a primary listing filed under a project takes its names; a resale cannot be', async () => {
    const l = await as(admin.token, http().post('/v1/listings'))
      .send({
        kind: 'PRIMARY',
        title: 'شقة في آي سيتي',
        unitType: '3BR',
        city: 'القاهرة الجديدة',
        area: 160,
        price: 8_000_000,
        developerProjectId: projectId,
      })
      .expect(201);
    expect(l.body).toMatchObject({
      developerName: 'ماونتن فيو',
      projectName: 'آي سيتي',
      developerProjectId: projectId,
    });
    await as(admin.token, http().post('/v1/listings'))
      .send({
        kind: 'RESALE',
        title: 'إعادة بيع',
        unitType: '3BR',
        city: 'القاهرة',
        area: 120,
        price: 3_000_000,
        developerProjectId: projectId,
      })
      .expect(400);
    await as(admin.token, http().delete(`/v1/developers/projects/${projectId}`)).expect(409);
    await as(admin.token, http().delete(`/v1/developers/${developerId}`)).expect(409);
  });

  it("BRK5-4: a lead's requirements find the listings that fit; a new fitting listing tells the rep", async () => {
    const lead = await as(admin.token, http().post('/v1/leads'))
      .send({
        fullName: 'باحث عن شقة',
        phone: `0103${stamp}`.slice(0, 11),
        allowDuplicate: true,
        assignedSalesId: rep.id,
      })
      .expect(201);
    leadId = lead.body.id;
    await as(rep.token, http().put(`/v1/listings/requirements/${leadId}`))
      .send({
        kinds: ['RESALE'],
        budgetMin: 3_000_000,
        budgetMax: 5_000_000,
        cities: ['التجمع'],
        bedroomsMin: 3,
      })
      .expect(200);
    await as(rep.token, http().put(`/v1/listings/requirements/${leadId}`))
      .send({ budgetMin: 6_000_000, budgetMax: 5_000_000 })
      .expect(400);
    await as(other.token, http().get(`/v1/listings/requirements/${leadId}`)).expect(404);

    const base = {
      kind: 'RESALE',
      unitType: '3BR',
      city: 'القاهرة الجديدة',
      district: 'التجمع الخامس',
      area: 170,
      bedrooms: 3,
    };
    const fits = await as(admin.token, http().post('/v1/listings'))
      .send({ ...base, title: 'تناسبه تمامًا', price: 4_500_000 })
      .expect(201);
    await as(admin.token, http().post('/v1/listings'))
      .send({ ...base, title: 'أغلى من ميزانيته', price: 7_000_000 })
      .expect(201);
    await as(admin.token, http().post('/v1/listings'))
      .send({ ...base, kind: 'RENT', title: 'إيجار', price: 30_000 })
      .expect(201);

    const m = await as(rep.token, http().get(`/v1/listings/matches/${leadId}`)).expect(200);
    expect(m.body.matches.map((x: { title: string; score: number }) => [x.title, x.score])).toEqual(
      [['تناسبه تمامًا', 100]],
    );
    expect(m.body.matches[0].reasons).toEqual(['budget', 'city', 'bedrooms']);
    const back = await as(
      rep.token,
      http().get(`/v1/listings/${fits.body.id}/matching-leads`),
    ).expect(200);
    expect(back.body.map((x: { id: string }) => x.id)).toEqual([leadId]);
    const othersView = await as(
      other.token,
      http().get(`/v1/listings/${fits.body.id}/matching-leads`),
    ).expect(200);
    expect(othersView.body).toEqual([]);
    const note = await testApp.rawPrisma.notification.findFirst({
      where: { userId: rep.id, templateCode: 'listing_matches_leads' },
    });
    expect(note).not.toBeNull();
    expect(
      await testApp.rawPrisma.notification.count({
        where: { userId: rep.id, templateCode: 'listing_matches_leads' },
      }),
    ).toBe(1);
  });

  it('BRK5-5: the manager distributes the unassigned leads to the team, fewest open leads first', async () => {
    const make = (n: number) =>
      as(admin.token, http().post('/v1/leads'))
        .send({
          fullName: `عميل بلا مندوب ${n}`,
          phone: `0104${stamp}${n}`.slice(0, 11),
          allowDuplicate: true,
        })
        .expect(201);
    const ids: string[] = [];
    for (const n of [1, 2, 3]) ids.push((await make(n)).body.id);
    const raw = testApp.rawPrisma;
    await raw.lead.updateMany({ where: { id: { in: ids } }, data: { assignedSalesId: null } });

    const preview = await as(manager.token, http().get('/v1/leads/distribute')).expect(200);
    expect(preview.body.unassigned).toBe(3);
    expect(
      preview.body.reps.map((r: { id: string; openLeads: number }) => [r.id, r.openLeads]).sort(),
    ).toEqual(
      [
        [manager.id, 0],
        [rep.id, 1],
      ].sort(),
    );
    await as(rep.token, http().get('/v1/leads/distribute')).expect(403);
    await as(rep.token, http().post('/v1/leads/distribute'))
      .send({ salesIds: [rep.id] })
      .expect(403);
    await as(manager.token, http().post('/v1/leads/distribute'))
      .send({ salesIds: [other.id], leadIds: ids })
      .expect(403);
    // The rep already holds one open lead; the manager none: the manager gets two, the rep one.
    const r = await as(manager.token, http().post('/v1/leads/distribute'))
      .send({ salesIds: [rep.id, manager.id], leadIds: ids })
      .expect(201);
    expect(r.body.assigned).toBe(3);
    expect(r.body.perRep).toEqual([
      { salesId: rep.id, count: 1, openLeads: 2 },
      { salesId: manager.id, count: 2, openLeads: 2 },
    ]);
    expect(await raw.lead.count({ where: { id: { in: ids }, assignedSalesId: null } })).toBe(0);
    expect(
      await raw.notification.count({
        where: { userId: rep.id, templateCode: 'leads_distributed' },
      }),
    ).toBe(1);
    // Nothing left to distribute.
    const again = await as(manager.token, http().post('/v1/leads/distribute'))
      .send({ salesIds: [rep.id], leadIds: ids })
      .expect(201);
    expect(again.body.assigned).toBe(0);
  });

  it('BRK5-6: another brokerage sees none of it; a developer company is refused', async () => {
    const b = await as(bAdmin.token, http().get('/v1/developers')).expect(200);
    expect(b.body).toEqual([]);
    await as(bAdmin.token, http().get(`/v1/developers/${developerId}`)).expect(404);
    await as(bAdmin.token, http().post(`/v1/developers/projects/${projectId}/plans`))
      .send({ name: 'خطة', downPaymentPct: 10, years: 5 })
      .expect(404);
    await as(bAdmin.token, http().get(`/v1/listings/matches/${leadId}`)).expect(404);
    await as(bAdmin.token, http().post('/v1/listings'))
      .send({
        kind: 'PRIMARY',
        title: 'محاولة',
        unitType: '3BR',
        city: 'القاهرة',
        area: 100,
        price: 1_000_000,
        developerProjectId: projectId,
      })
      .expect(400);
    const dev = await as(devAdmin, http().get('/v1/developers')).expect(403);
    expect(JSON.stringify(dev.body)).toContain('NOT_FOR_DEVELOPER');
  });
});
