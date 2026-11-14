/**
 * BRK-6b — co-broking: an outside broker shares a deal.
 *
 * - Their % of the commission comes off the top; the team's shares are
 *   worked out on what is left. A % without the broker's name is refused.
 * - Their share is paid once the deal's commission is collected, once; a
 *   paid share blocks taking the collection back. A rep does not pay it.
 * - The report counts it apart and takes it off what the company keeps.
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

describe('BRK-6b — co-broking (e2e)', () => {
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
        name: `BRK6b ${tag} ${stamp}`,
        slug: `brk6b-${tag}-${stamp}`,
        type: CompanyType.BROKERAGE,
      },
      select: { id: true },
    });
    companyIds.push(company.id);
    await seedUnitTypesForCompany(raw, company.id);
    const staff = async (role: UserRole, who: string, managerId?: string): Promise<Staff> => {
      const email = `brk6b-${tag}-${who}-${stamp}@example.com`;
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

  let dealId: string;

  it("BRK6b-1: the outside broker's share comes off the top; the team shares the rest", async () => {
    await as(admin.token, http().put('/v1/deals/rules/RESALE'))
      .send({ agentPct: 40, managerPct: 5 })
      .expect(200);
    const base = {
      kind: 'RESALE',
      customerName: 'مشتري مشترك',
      dealValue: 4_000_000,
      commissionTotal: 100_000,
      closedOn: today(),
    };
    await as(rep.token, http().post('/v1/deals'))
      .send({ ...base, coBrokerPct: 25 })
      .expect(400);
    const d = await as(rep.token, http().post('/v1/deals'))
      .send({
        ...base,
        coBrokerName: 'مكتب الريادة للعقارات',
        coBrokerPhone: '01011122233',
        coBrokerPct: 25,
      })
      .expect(201);
    dealId = d.body.id;
    expect(d.body).toMatchObject({ coBrokerName: 'مكتب الريادة للعقارات', coBrokerPaidAt: null });
    expect(Number(d.body.coBrokerAmount)).toBe(25_000);
    expect(
      d.body.splits.map((s: { role: string; amount: string }) => [s.role, Number(s.amount)]),
    ).toEqual([
      ['AGENT', 30_000],
      ['MANAGER', 3_750],
    ]);
  });

  it('BRK6b-2: paid once the commission is collected, once; a paid share holds the collection', async () => {
    await as(admin.token, http().post(`/v1/deals/${dealId}/co-broker/pay`)).expect(409);
    await as(admin.token, http().patch(`/v1/deals/${dealId}/commission`))
      .send({ commissionReceived: 100_000 })
      .expect(200);
    await as(rep.token, http().post(`/v1/deals/${dealId}/co-broker/pay`)).expect(403);
    const paid = await as(admin.token, http().post(`/v1/deals/${dealId}/co-broker/pay`)).expect(
      201,
    );
    expect(paid.body.coBrokerPaidAt).not.toBeNull();
    await as(admin.token, http().post(`/v1/deals/${dealId}/co-broker/pay`)).expect(409);
    await as(admin.token, http().patch(`/v1/deals/${dealId}/commission`))
      .send({ commissionReceived: 50_000 })
      .expect(409);
    await as(admin.token, http().post(`/v1/deals/${dealId}/co-broker/unpay`)).expect(201);
    await as(admin.token, http().post(`/v1/deals/${dealId}/co-broker/unpay`)).expect(404);
  });

  it("BRK6b-3: the report takes the outside broker's share off what the company keeps", async () => {
    const r = await as(admin.token, http().get('/v1/deals/report')).expect(200);
    expect(r.body.totals).toMatchObject({
      commission: 100_000,
      staffShares: 33_750,
      coBrokerShares: 25_000,
      companyNet: 41_250,
    });
    await as(bAdmin.token, http().post(`/v1/deals/${dealId}/co-broker/pay`)).expect(404);
  });
});
