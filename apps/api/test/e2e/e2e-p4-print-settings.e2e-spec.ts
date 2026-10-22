/**
 * P4 — printed documents. The company's signature and stamp print on its
 * final documents, so the images must never reach a customer, a broker or
 * another company: only the company's own staff read them, and only its
 * admin changes them. The wording of contracts and booking forms is the
 * company's alone too.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';

/** A 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('P4 — print settings and document wording (e2e)', () => {
  let testApp: TestApp;
  let adminToken: string;
  let companyId = '';
  let otherCompanyId = '';
  const userIds: string[] = [];
  const templateIds: string[] = [];
  let hadSettings = false;
  const stamp = Date.now().toString().slice(-7);
  const tokens: Record<'sales' | 'customer' | 'broker' | 'otherAdmin', string> = {
    sales: '',
    customer: '',
    broker: '',
    otherAdmin: '',
  };

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(r: T, token: string) => r.set('Authorization', bearer(token));

  const makeUser = async (role: UserRole, inCompany: string, tag: string) => {
    const u = await testApp.rawPrisma.user.create({
      data: { role, fullName: `P4 ${tag}`, email: `p4-${tag}-${stamp}@example.com`, locale: 'en', companyId: inCompany },
      select: { id: true },
    });
    userIds.push(u.id);
    return testApp.signAccessToken(u.id, role);
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const admin = await testApp.rawPrisma.user.findFirstOrThrow({
      where: { email: 'admin@example.com', role: UserRole.ADMIN },
      select: { companyId: true },
    });
    companyId = admin.companyId!;
    hadSettings = !!(await testApp.rawPrisma.printSettings.findFirst({ where: { companyId } }));

    otherCompanyId = (
      await testApp.rawPrisma.company.create({
        data: { name: `P4 Other ${stamp}`, slug: `p4-other-${stamp}` },
        select: { id: true },
      })
    ).id;

    tokens.sales = await makeUser(UserRole.SALES, companyId, 'sales');
    tokens.customer = await makeUser(UserRole.CUSTOMER, companyId, 'customer');
    tokens.broker = await makeUser(UserRole.BROKER, companyId, 'broker');
    tokens.otherAdmin = await makeUser(UserRole.ADMIN, otherCompanyId, 'other-admin');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.documentTemplate.deleteMany({ where: { id: { in: templateIds } } });
    if (!hadSettings) await raw.printSettings.deleteMany({ where: { companyId } });
    await raw.printSettings.deleteMany({ where: { companyId: otherCompanyId } });
    await raw.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await raw.user.deleteMany({ where: { id: { in: userIds } } });
    await raw.company.deleteMany({ where: { id: otherCompanyId } });
    await testApp.close();
  });

  it('P4-1: the admin uploads the signature and stamp; a non-image is refused', async () => {
    await as(http().put('/v1/company/print-settings/signature'), adminToken).attach('file', PNG, 'sig.png').expect(200);
    const res = await as(http().put('/v1/company/print-settings/stamp'), adminToken).attach('file', PNG, 'stamp.png').expect(200);
    expect(res.body.stamp).toMatch(/^data:image\/png;base64,/);
    expect(res.body.signature).toMatch(/^data:image\/png;base64,/);

    await as(http().put('/v1/company/print-settings/stamp'), adminToken)
      .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'stamp.png')
      .expect(400);
  });

  it('P4-2: the company’s sales staff read them to print; customers and brokers do not', async () => {
    const res = await as(http().get('/v1/company/print-settings'), tokens.sales).expect(200);
    expect(res.body.stamp).toMatch(/^data:image\/png;base64,/);
    await as(http().get('/v1/company/print-settings'), tokens.customer).expect(403);
    await as(http().get('/v1/company/print-settings'), tokens.broker).expect(403);
  });

  it('P4-3: only the admin changes them', async () => {
    await as(http().patch('/v1/company/print-settings'), tokens.sales).send({ marginTopMm: 30 }).expect(403);
    await as(http().put('/v1/company/print-settings/stamp'), tokens.sales).attach('file', PNG, 's.png').expect(403);
    await as(http().delete('/v1/company/print-settings/stamp'), tokens.sales).expect(403);
  });

  it('P4-4: another company sees none of it', async () => {
    const res = await as(http().get('/v1/company/print-settings'), tokens.otherAdmin).expect(200);
    expect(res.body.signature).toBeNull();
    expect(res.body.stamp).toBeNull();
  });

  it('P4-5: a letterhead mode needs its paper', async () => {
    await as(http().patch('/v1/company/print-settings'), adminToken).send({ letterheadMode: 'FULL_PAGE', pageImageUrl: null }).expect(400);
    await as(http().patch('/v1/company/print-settings'), adminToken)
      .send({ headerImageUrl: 'javascript:alert(1)' })
      .expect(400);
  });

  it('P4-6: wording — one default per kind, the company’s alone', async () => {
    const a = await as(http().post('/v1/document-templates'), adminToken)
      .send({ documentType: 'CONTRACT', variant: 'CASH', name: `P4 Cash A ${stamp}`, body: '## Price\n{{contract.total}}', isDefault: true })
      .expect(201);
    templateIds.push(a.body.id);
    const b = await as(http().post('/v1/document-templates'), adminToken)
      .send({ documentType: 'CONTRACT', variant: 'CASH', name: `P4 Cash B ${stamp}`, body: 'x', isDefault: true })
      .expect(201);
    templateIds.push(b.body.id);

    const list = await as(http().get('/v1/document-templates?documentType=CONTRACT'), tokens.sales).expect(200);
    const cashDefaults = (list.body as { variant: string; isDefault: boolean }[]).filter((t) => t.variant === 'CASH' && t.isDefault);
    expect(cashDefaults).toHaveLength(1);
    expect((list.body as { id: string; isDefault: boolean }[]).find((t) => t.id === b.body.id)?.isDefault).toBe(true);

    // A booking wording is for any sale, whatever is sent.
    const r = await as(http().post('/v1/document-templates'), adminToken)
      .send({ documentType: 'RESERVATION', variant: 'INSTALLMENT', name: `P4 Booking ${stamp}`, body: 'x' })
      .expect(201);
    templateIds.push(r.body.id);
    expect(r.body.variant).toBe('ANY');

    // Not another company's, and not the sales staff's to change.
    await as(http().get(`/v1/document-templates/${a.body.id}`), tokens.otherAdmin).expect(404);
    const others = await as(http().get('/v1/document-templates'), tokens.otherAdmin).expect(200);
    expect(others.body).toHaveLength(0);
    await as(http().patch(`/v1/document-templates/${a.body.id}`), tokens.sales).send({ name: 'x' }).expect(403);
    await as(http().get('/v1/document-templates'), tokens.customer).expect(403);

    await as(http().delete(`/v1/document-templates/${b.body.id}`), adminToken).expect(200);
    await as(http().get(`/v1/document-templates/${b.body.id}`), adminToken).expect(404);
  });

  it('P4-7: removing the stamp keeps the signature', async () => {
    const res = await as(http().delete('/v1/company/print-settings/stamp'), adminToken).expect(200);
    expect(res.body.stamp).toBeNull();
    expect(res.body.signature).toMatch(/^data:image\/png;base64,/);
  });

  it('P4-8: the buyer’s national ID and address are the company’s record', async () => {
    const customerId = userIds[1]!; // created second, as the customer
    const set = await as(http().patch(`/v1/users/${customerId}`), adminToken)
      .send({ nationalId: ' 29001011234567 ', address: '12 شارع التسعين، القاهرة الجديدة' })
      .expect(200);
    expect(set.body).toMatchObject({ nationalId: '29001011234567', address: '12 شارع التسعين، القاهرة الجديدة' });

    await as(http().patch(`/v1/users/${customerId}`), adminToken).send({ nationalId: '12-34' }).expect(400);

    // The buyer cannot change it from their own profile.
    await as(http().patch('/v1/users/me'), tokens.customer).send({ nationalId: '11111111111111', address: 'x' }).expect(200);
    const after = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: customerId }, select: { nationalId: true, address: true } });
    expect(after).toEqual({ nationalId: '29001011234567', address: '12 شارع التسعين، القاهرة الجديدة' });

    // An emptied field is cleared.
    const cleared = await as(http().patch(`/v1/users/${customerId}`), adminToken).send({ address: '' }).expect(200);
    expect(cleared.body.address).toBeNull();
  });
});
