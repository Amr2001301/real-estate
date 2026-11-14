/**
 * BRK-3 — a brokerage company's deals, commission rules, developer claims
 * and staff payouts.
 *
 * - The admin sets the commission rule per kind (agent %, manager %); the
 *   two together never pass 100%; a rep reads the rules but cannot set one.
 * - A primary deal on a listing: D-0001, the listing closes, the lead is
 *   WON, the agent and their manager get their shares, and a claim CL-0001
 *   on the developer is opened for the whole commission.
 * - The claim is submitted, paid in two payments (PARTIALLY_PAID → PAID);
 *   no more than what is left; the deal's collected follows the payments.
 * - A share is paid out only once the deal's commission is collected; the
 *   agent is told; a paid-out share blocks removing a claim payment.
 * - A resale deal is collected directly; a primary one only through its claim.
 * - A listing with a deal takes no second one; a future close date and a
 *   commission above the deal are refused.
 * - A rep records deals as themself only, sees their own deals and their own
 *   commissions, and does not cancel or touch money.
 * - Cancelling: refused once money moved; otherwise the listing is back on
 *   the market, the lead back to negotiation, the shares and claim gone.
 * - Two brokerages never see each other's deals; a developer company is
 *   refused (NOT_FOR_DEVELOPER).
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

describe('BRK-3 — brokerage deals (e2e)', () => {
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
        name: `BRK3 ${tag} ${stamp}`,
        slug: `brk3-${tag}-${stamp}`,
        type: CompanyType.BROKERAGE,
      },
      select: { id: true },
    });
    companyIds.push(company.id);
    await seedUnitTypesForCompany(raw, company.id);
    const staff = async (role: UserRole, who: string, managerId?: string): Promise<Staff> => {
      const email = `brk3-${tag}-${who}-${stamp}@example.com`;
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

  const base = {
    title: 'شقة 3 غرف بالتجمع',
    unitType: '3BR',
    city: 'القاهرة الجديدة',
    area: 165,
    price: 4_500_000,
  };
  let primaryDealId: string;
  let claimId: string;
  let leadId: string;
  let primaryListingId: string;

  it('BRK3-1: the admin sets the rules; the shares never pass 100%; a rep only reads them', async () => {
    await as(admin.token, http().put('/v1/deals/rules/PRIMARY'))
      .send({ agentPct: 30, managerPct: 5 })
      .expect(200);
    await as(admin.token, http().put('/v1/deals/rules/RESALE'))
      .send({ agentPct: 40, managerPct: 0 })
      .expect(200);
    await as(admin.token, http().put('/v1/deals/rules/RENT'))
      .send({ agentPct: 70, managerPct: 40 })
      .expect(400);
    await as(rep.token, http().put('/v1/deals/rules/RENT'))
      .send({ agentPct: 10, managerPct: 0 })
      .expect(403);
    const rules = await as(rep.token, http().get('/v1/deals/rules')).expect(200);
    expect(rules.body).toEqual([
      expect.objectContaining({ kind: 'PRIMARY', agentPct: 30, managerPct: 5 }),
      expect.objectContaining({ kind: 'RESALE', agentPct: 40, managerPct: 0 }),
      expect.objectContaining({ kind: 'RENT', agentPct: 0, managerPct: 0 }),
    ]);
  });

  it('BRK3-2: a primary deal closes the listing, wins the lead, shares the commission and claims the developer', async () => {
    const listing = await as(admin.token, http().post('/v1/listings'))
      .send({
        ...base,
        kind: 'PRIMARY',
        title: 'وحدة من المطوّر',
        developerName: 'مطوّر النخبة',
        agentId: rep.id,
      })
      .expect(201);
    primaryListingId = listing.body.id;
    const lead = await as(admin.token, http().post('/v1/leads'))
      .send({
        fullName: 'عميل الصفقة',
        phone: `0101${stamp}`.slice(0, 11),
        allowDuplicate: true,
        assignedSalesId: rep.id,
      })
      .expect(201);
    leadId = lead.body.id;

    const deal = await as(rep.token, http().post('/v1/deals'))
      .send({
        listingId: listing.body.id,
        leadId,
        dealValue: 4_500_000,
        commissionTotal: 135_000,
        closedOn: today(),
      })
      .expect(201);
    primaryDealId = deal.body.id;
    expect(deal.body).toMatchObject({
      code: 'D-0001',
      kind: 'PRIMARY',
      status: 'CLOSED',
      customerName: 'عميل الصفقة',
      agentId: rep.id,
    });
    expect(
      deal.body.splits.map((s: { role: string; userId: string; amount: string }) => [
        s.role,
        s.userId,
        Number(s.amount),
      ]),
    ).toEqual([
      ['AGENT', rep.id, 40_500],
      ['MANAGER', manager.id, 6_750],
    ]);
    expect(deal.body.claim).toMatchObject({
      code: 'CL-0001',
      developerName: 'مطوّر النخبة',
      status: 'PENDING',
    });
    expect(Number(deal.body.claim.amount)).toBe(135_000);
    claimId = deal.body.claim.id;

    const raw = testApp.rawPrisma;
    expect((await raw.listing.findUniqueOrThrow({ where: { id: listing.body.id } })).status).toBe(
      'CLOSED',
    );
    expect((await raw.lead.findUniqueOrThrow({ where: { id: leadId } })).stage).toBe('WON');

    // One deal per listing.
    await as(admin.token, http().post('/v1/deals'))
      .send({
        listingId: listing.body.id,
        customerName: 'آخر',
        dealValue: 4_500_000,
        commissionTotal: 1,
        closedOn: today(),
      })
      .expect(409);
  });

  it('BRK3-3: refuses a close date in the future and a commission above the deal', async () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await as(admin.token, http().post('/v1/deals'))
      .send({
        kind: 'RESALE',
        customerName: 'عميل',
        dealValue: 1_000_000,
        commissionTotal: 20_000,
        closedOn: tomorrow,
      })
      .expect(400);
    await as(admin.token, http().post('/v1/deals'))
      .send({
        kind: 'RESALE',
        customerName: 'عميل',
        dealValue: 1_000,
        commissionTotal: 20_000,
        closedOn: today(),
      })
      .expect(400);
    await as(admin.token, http().post('/v1/deals'))
      .send({
        kind: 'PRIMARY',
        customerName: 'عميل',
        dealValue: 1_000_000,
        commissionTotal: 20_000,
        closedOn: today(),
      })
      .expect(400);
  });

  it('BRK3-4: a share is not paid before the commission is collected; the claim is paid in parts', async () => {
    const splits = await as(admin.token, http().get(`/v1/deals/splits?userId=${rep.id}`)).expect(
      200,
    );
    const agentShare = splits.body.data.find(
      (s: { deal: { id: string } }) => s.deal.id === primaryDealId,
    );
    expect(agentShare.payable).toBe(false);
    await as(admin.token, http().post(`/v1/deals/splits/${agentShare.id}/pay`)).expect(409);

    await as(admin.token, http().post(`/v1/deals/claims/${claimId}/submit`))
      .send({ submittedOn: today() })
      .expect(201);
    await as(admin.token, http().post(`/v1/deals/claims/${claimId}/payments`))
      .send({ amount: 200_000, receivedOn: today() })
      .expect(400);
    const part = await as(admin.token, http().post(`/v1/deals/claims/${claimId}/payments`))
      .send({ amount: 35_000, receivedOn: today() })
      .expect(201);
    expect(part.body.data.find((c: { id: string }) => c.id === claimId)).toMatchObject({
      status: 'PARTIALLY_PAID',
      paid: 35_000,
    });
    expect(part.body.totals).toMatchObject({
      claimed: 135_000,
      paid: 35_000,
      outstanding: 100_000,
    });
    const rest = await as(admin.token, http().post(`/v1/deals/claims/${claimId}/payments`))
      .send({ amount: 100_000, receivedOn: today() })
      .expect(201);
    expect(rest.body.data.find((c: { id: string }) => c.id === claimId)).toMatchObject({
      status: 'PAID',
      paid: 135_000,
    });
    // A primary deal's commission is collected through its claim only.
    await as(admin.token, http().patch(`/v1/deals/${primaryDealId}/commission`))
      .send({ commissionReceived: 1 })
      .expect(400);
    const deal = await as(admin.token, http().get(`/v1/deals/${primaryDealId}`)).expect(200);
    expect(Number(deal.body.commissionReceived)).toBe(135_000);

    await as(admin.token, http().post(`/v1/deals/splits/${agentShare.id}/pay`)).expect(201);
    await as(admin.token, http().post(`/v1/deals/splits/${agentShare.id}/pay`)).expect(409);
    const note = await testApp.rawPrisma.notification.findFirst({
      where: { userId: rep.id, templateCode: 'deal_commission_paid' },
    });
    expect(note).not.toBeNull();

    // Money paid out on the deal: its collection can no longer be undone, nor the deal cancelled.
    const paymentId = rest.body.data.find((c: { id: string }) => c.id === claimId).payments[1].id;
    await as(admin.token, http().delete(`/v1/deals/claim-payments/${paymentId}`)).expect(409);
    await as(admin.token, http().post(`/v1/deals/${primaryDealId}/cancel`))
      .send({ reason: 'خطأ في التسجيل' })
      .expect(409);
  });

  it('BRK3-5: a rep records as themself, sees their own deals and commissions, and does not touch money', async () => {
    const own = await as(rep.token, http().post('/v1/deals'))
      .send({
        kind: 'RESALE',
        customerName: 'مشتري',
        customerPhone: '01001112223',
        dealValue: 2_000_000,
        commissionTotal: 50_000,
        closedOn: today(),
        agentId: other.id,
      })
      .expect(201);
    expect(own.body).toMatchObject({ code: 'D-0002', agentId: rep.id });
    // The other rep's deal, recorded by the admin.
    const theirs = await as(admin.token, http().post('/v1/deals'))
      .send({
        kind: 'RESALE',
        customerName: 'مشتري آخر',
        dealValue: 1_000_000,
        commissionTotal: 25_000,
        closedOn: today(),
        agentId: other.id,
      })
      .expect(201);

    const list = await as(rep.token, http().get('/v1/deals')).expect(200);
    expect(list.body.data.map((d: { code: string }) => d.code).sort()).toEqual([
      'D-0001',
      'D-0002',
    ]);
    await as(rep.token, http().get(`/v1/deals/${theirs.body.id}`)).expect(404);
    // The manager sees their team's deals and their own share, not the other rep's.
    const team = await as(manager.token, http().get('/v1/deals')).expect(200);
    expect(team.body.data.map((d: { code: string }) => d.code).sort()).toEqual([
      'D-0001',
      'D-0002',
    ]);

    const mine = await as(rep.token, http().get(`/v1/deals/splits?userId=${other.id}`)).expect(200);
    expect(mine.body.data.every((s: { userId: string }) => s.userId === rep.id)).toBe(true);
    expect(mine.body.totals).toMatchObject({ paid: 40_500, awaitingCollection: 20_000 });

    await as(rep.token, http().post(`/v1/deals/${own.body.id}/cancel`))
      .send({ reason: 'خطأ' })
      .expect(403);
    await as(rep.token, http().patch(`/v1/deals/${own.body.id}/commission`))
      .send({ commissionReceived: 50_000 })
      .expect(403);
    await as(rep.token, http().get('/v1/deals/claims')).expect(403);

    // A resale deal is collected directly, never above its commission.
    await as(admin.token, http().patch(`/v1/deals/${own.body.id}/commission`))
      .send({ commissionReceived: 60_000 })
      .expect(400);
    const got = await as(admin.token, http().patch(`/v1/deals/${own.body.id}/commission`))
      .send({ commissionReceived: 50_000 })
      .expect(200);
    expect(Number(got.body.commissionReceived)).toBe(50_000);

    const totals = await as(admin.token, http().get('/v1/deals')).expect(200);
    expect(totals.body.meta.facets.sums).toMatchObject({
      commission: '210000.00',
      received: '185000.00',
      outstanding: '25000.00',
    });
  });

  it('BRK3-6: cancelling puts the listing back on the market and the lead back to negotiation', async () => {
    const listing = await as(admin.token, http().post('/v1/listings'))
      .send({ ...base, kind: 'RESALE', title: 'شقة للبيع' })
      .expect(201);
    const lead = await as(admin.token, http().post('/v1/leads'))
      .send({
        fullName: 'عميل يتراجع',
        phone: `0102${stamp}`.slice(0, 11),
        allowDuplicate: true,
        assignedSalesId: rep.id,
      })
      .expect(201);
    const deal = await as(manager.token, http().post('/v1/deals'))
      .send({
        listingId: listing.body.id,
        leadId: lead.body.id,
        dealValue: 4_000_000,
        commissionTotal: 80_000,
        closedOn: today(),
      })
      .expect(201);
    expect(deal.body.agentId).toBe(rep.id);

    const cancelled = await as(manager.token, http().post(`/v1/deals/${deal.body.id}/cancel`))
      .send({ reason: 'العميل تراجع' })
      .expect(201);
    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'العميل تراجع',
      splits: [],
    });
    const raw = testApp.rawPrisma;
    expect((await raw.listing.findUniqueOrThrow({ where: { id: listing.body.id } })).status).toBe(
      'AVAILABLE',
    );
    expect((await raw.lead.findUniqueOrThrow({ where: { id: lead.body.id } })).stage).toBe(
      'NEGOTIATION',
    );
    await as(manager.token, http().post(`/v1/deals/${deal.body.id}/cancel`))
      .send({ reason: 'مرة أخرى' })
      .expect(409);
    // The listing takes a new deal once its deal is cancelled.
    await as(admin.token, http().post('/v1/deals'))
      .send({
        listingId: listing.body.id,
        customerName: 'مشتري جديد',
        dealValue: 3_900_000,
        commissionTotal: 78_000,
        closedOn: today(),
      })
      .expect(201);
  });

  it('BRK3-7: another brokerage sees none of it; a developer company is refused', async () => {
    const list = await as(bAdmin.token, http().get('/v1/deals')).expect(200);
    expect(list.body.meta.total).toBe(0);
    await as(bAdmin.token, http().get(`/v1/deals/${primaryDealId}`)).expect(404);
    await as(bAdmin.token, http().post(`/v1/deals/${primaryDealId}/cancel`))
      .send({ reason: 'محاولة' })
      .expect(404);
    await as(bAdmin.token, http().post(`/v1/deals/claims/${claimId}/payments`))
      .send({ amount: 1, receivedOn: today() })
      .expect(404);
    await as(bAdmin.token, http().post('/v1/deals'))
      .send({
        listingId: primaryListingId,
        customerName: 'عميل',
        dealValue: 10,
        commissionTotal: 1,
        closedOn: today(),
      })
      .expect(400);
    expect(
      JSON.stringify(
        (
          await as(bAdmin.token, http().post('/v1/deals')).send({
            listingId: primaryListingId,
            customerName: 'عميل',
            dealValue: 10,
            commissionTotal: 1,
            closedOn: today(),
          })
        ).body,
      ),
    ).toContain('الوحدة غير موجودة');
    await as(bAdmin.token, http().post('/v1/deals'))
      .send({ kind: 'RESALE', leadId, dealValue: 10, commissionTotal: 1, closedOn: today() })
      .expect(400);
    const dev = await as(devAdmin, http().get('/v1/deals')).expect(403);
    expect(JSON.stringify(dev.body)).toContain('NOT_FOR_DEVELOPER');
  });
});
