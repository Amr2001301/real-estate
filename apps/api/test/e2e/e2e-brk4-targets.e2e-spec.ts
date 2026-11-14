/**
 * BRK-4 — a brokerage's financial report and its agents' monthly targets.
 *
 * - The admin sets a rep's target for the month (commission + deals + bonus);
 *   the rep sees only their own, the manager their team, the admin all.
 * - A deal that meets the target tells the rep and their manager once.
 * - The bonus is paid only once the target is met; a paid bonus locks the
 *   target; a cancelled deal brings the month back below target.
 * - The report: totals, the staff shares and what the company keeps (after
 *   shares and earned bonuses), by kind, by agent, a 12-month trend.
 * - Only the admin reads the report or sets targets; another brokerage sees
 *   none of it; a developer company is refused.
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
  ],
  SALES_MANAGER: [
    'listings:read',
    'listings:manage',
    'deals:read',
    'deals:manage',
    'leads:read',
    'leads:manage',
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

describe('BRK-4 — brokerage reports and targets (e2e)', () => {
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
        name: `BRK4 ${tag} ${stamp}`,
        slug: `brk4-${tag}-${stamp}`,
        type: CompanyType.BROKERAGE,
      },
      select: { id: true },
    });
    companyIds.push(company.id);
    await seedUnitTypesForCompany(raw, company.id);
    const staff = async (role: UserRole, who: string, managerId?: string): Promise<Staff> => {
      const email = `brk4-${tag}-${who}-${stamp}@example.com`;
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

  const period = () => new Date().toISOString().slice(0, 7);
  let targetId: string;
  let dealId: string;

  it("BRK4-1: the admin sets a rep's target; the rep and their manager see it, another rep does not", async () => {
    await as(admin.token, http().put('/v1/deals/rules/RESALE'))
      .send({ agentPct: 40, managerPct: 5 })
      .expect(200);
    await as(admin.token, http().put(`/v1/deals/targets/${period()}/${rep.id}`))
      .send({ commissionTarget: 100_000, dealsTarget: 2, bonusAmount: 5_000 })
      .expect(200);
    await as(rep.token, http().put(`/v1/deals/targets/${period()}/${rep.id}`))
      .send({ commissionTarget: 1, dealsTarget: 0, bonusAmount: 0 })
      .expect(403);
    await as(admin.token, http().put(`/v1/deals/targets/2026-13/${rep.id}`))
      .send({ commissionTarget: 1, dealsTarget: 0, bonusAmount: 0 })
      .expect(400);

    const mine = await as(rep.token, http().get('/v1/deals/targets')).expect(200);
    expect(mine.body.rows.map((r: { user: { id: string } }) => r.user.id)).toEqual([rep.id]);
    expect(mine.body.rows[0]).toMatchObject({
      actual: { commission: 0, deals: 0 },
      progress: { achieved: false },
      bonus: 'PENDING',
    });
    targetId = mine.body.rows[0].target.id;
    const team = await as(manager.token, http().get('/v1/deals/targets')).expect(200);
    expect(team.body.rows.map((r: { user: { id: string } }) => r.user.id).sort()).toEqual(
      [manager.id, rep.id].sort(),
    );
    const all = await as(admin.token, http().get('/v1/deals/targets')).expect(200);
    expect(all.body.rows.length).toBe(3);
    expect(all.body.totals).toMatchObject({ withTarget: 1, achieved: 0 });
    const theirs = await as(other.token, http().get('/v1/deals/targets')).expect(200);
    expect(theirs.body.rows.map((r: { user: { id: string } }) => r.user.id)).toEqual([other.id]);
  });

  it('BRK4-2: the bonus waits for the target; the deal that meets it tells the rep and manager once', async () => {
    await as(admin.token, http().post(`/v1/deals/targets/${targetId}/pay-bonus`)).expect(409);
    const today = new Date().toISOString().slice(0, 10);
    await as(rep.token, http().post('/v1/deals'))
      .send({
        kind: 'RESALE',
        customerName: 'مشتري أول',
        dealValue: 3_000_000,
        commissionTotal: 60_000,
        closedOn: today,
      })
      .expect(201);
    const second = await as(rep.token, http().post('/v1/deals'))
      .send({
        kind: 'RESALE',
        customerName: 'مشتري ثانٍ',
        dealValue: 2_000_000,
        commissionTotal: 40_000,
        closedOn: today,
      })
      .expect(201);
    dealId = second.body.id;
    const t = await as(rep.token, http().get('/v1/deals/targets')).expect(200);
    expect(t.body.rows[0]).toMatchObject({
      actual: { commission: 100_000, deals: 2 },
      progress: { achieved: true, commissionPct: 100 },
      bonus: 'EARNED',
    });
    // A third deal does not tell them again.
    await as(rep.token, http().post('/v1/deals'))
      .send({
        kind: 'RESALE',
        customerName: 'مشتري ثالث',
        dealValue: 500_000,
        commissionTotal: 10_000,
        closedOn: today,
      })
      .expect(201);
    const raw = testApp.rawPrisma;
    expect(
      await raw.notification.count({
        where: { userId: rep.id, templateCode: 'brokerage_target_achieved' },
      }),
    ).toBe(1);
    expect(
      await raw.notification.count({
        where: { userId: manager.id, templateCode: 'brokerage_target_achieved' },
      }),
    ).toBe(1);

    await as(admin.token, http().post(`/v1/deals/targets/${targetId}/pay-bonus`)).expect(201);
    await as(admin.token, http().post(`/v1/deals/targets/${targetId}/pay-bonus`)).expect(409);
    expect(
      await raw.notification.count({
        where: { userId: rep.id, templateCode: 'brokerage_bonus_paid' },
      }),
    ).toBe(1);
    // A paid bonus locks the target.
    await as(admin.token, http().put(`/v1/deals/targets/${period()}/${rep.id}`))
      .send({ commissionTarget: 1, dealsTarget: 0, bonusAmount: 9 })
      .expect(409);
    await as(admin.token, http().delete(`/v1/deals/targets/${targetId}`)).expect(409);
  });

  it('BRK4-3: the report counts the month — shares, bonuses and what the company keeps', async () => {
    const r = await as(admin.token, http().get('/v1/deals/report')).expect(200);
    expect(r.body.from).toBe(period());
    // 110,000 commission; rep 40% (44,000) + manager 5% (5,500); bonus 5,000.
    expect(r.body.totals).toMatchObject({
      deals: 3,
      commission: 110_000,
      received: 0,
      outstanding: 110_000,
      staffShares: 49_500,
      bonuses: 5_000,
      bonusesPaid: 5_000,
      companyNet: 55_500,
    });
    expect(r.body.byKind.find((k: { kind: string }) => k.kind === 'RESALE')).toMatchObject({
      deals: 3,
      commission: 110_000,
    });
    expect(r.body.byAgent[0]).toMatchObject({
      userId: rep.id,
      fullName: 'a rep',
      deals: 3,
      commission: 110_000,
      shares: 44_000,
    });
    expect(r.body.trend).toHaveLength(12);
    expect(r.body.trend[11]).toMatchObject({ month: period(), commission: 110_000 });
    await as(admin.token, http().get('/v1/deals/report?from=2026-05&to=2026-01')).expect(400);
    await as(manager.token, http().get('/v1/deals/report')).expect(403);
    await as(rep.token, http().get('/v1/deals/report')).expect(403);
  });

  it('BRK4-4: undoing the bonus and cancelling a deal brings the month back below target', async () => {
    await as(admin.token, http().post(`/v1/deals/targets/${targetId}/unpay-bonus`)).expect(201);
    await as(manager.token, http().post(`/v1/deals/${dealId}/cancel`))
      .send({ reason: 'تراجع المشتري' })
      .expect(201);
    const t = await as(admin.token, http().get('/v1/deals/targets')).expect(200);
    const row = t.body.rows.find((x: { user: { id: string } }) => x.user.id === rep.id);
    expect(row).toMatchObject({
      actual: { commission: 70_000, deals: 2 },
      progress: { achieved: false },
      bonus: 'PENDING',
    });
    await as(admin.token, http().post(`/v1/deals/targets/${targetId}/pay-bonus`)).expect(409);
  });

  it('BRK4-5: another brokerage sees none of it; a developer company is refused', async () => {
    const b = await as(bAdmin.token, http().get('/v1/deals/targets')).expect(200);
    expect(b.body.rows.some((r: { user: { id: string } }) => r.user.id === rep.id)).toBe(false);
    const br = await as(bAdmin.token, http().get('/v1/deals/report')).expect(200);
    expect(br.body.totals.deals).toBe(0);
    await as(bAdmin.token, http().post(`/v1/deals/targets/${targetId}/pay-bonus`)).expect(404);
    await as(bAdmin.token, http().put(`/v1/deals/targets/${period()}/${rep.id}`))
      .send({ commissionTarget: 1, dealsTarget: 0, bonusAmount: 0 })
      .expect(400);
    const dev = await as(devAdmin, http().get('/v1/deals/targets')).expect(403);
    expect(JSON.stringify(dev.body)).toContain('NOT_FOR_DEVELOPER');
  });
});
