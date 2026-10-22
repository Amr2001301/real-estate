/**
 * The company's own paper form. A company uploads its booking form, its
 * receipt and its contract and places the values on them; the booking form
 * and the contract are A4, a receipt may be A4, A5 or half a sheet and has
 * no customer's signature. Only the admin designs them, the staff read them,
 * and one company never reaches another's.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';

describe('Paper forms — the company’s own booking form, receipt and contract (e2e)', () => {
  let testApp: TestApp;
  let adminToken: string;
  let companyId = '';
  let otherCompanyId = '';
  const userIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);
  const tokens: Record<'sales' | 'customer' | 'broker' | 'otherAdmin', string> = {
    sales: '',
    customer: '',
    broker: '',
    otherAdmin: '',
  };
  let hadForms = false;

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(r: T, token: string) => r.set('Authorization', bearer(token));

  const page = (n: number) => ({ imageUrl: `https://cdn.example.com/forms/${stamp}-${n}.png` });
  const field = (id: string, key: string, extra: Record<string, unknown> = {}) => ({
    id,
    key,
    page: 0,
    x: 0.1,
    y: 0.1,
    w: 0.3,
    h: 0.03,
    size: 11,
    align: 'start',
    ...extra,
  });
  const form = (over: Record<string, unknown> = {}) => ({
    documentType: 'RESERVATION',
    name: `Form ${stamp}`,
    pages: [page(1), page(2)],
    fields: [field('a', 'customer.name'), field('b', 'customer.nationalId', { page: 1 }), field('c', 'sign.customer', { h: 0.06 })],
    ...over,
  });

  const makeUser = async (role: UserRole, inCompany: string, tag: string) => {
    const u = await testApp.rawPrisma.user.create({
      data: { role, fullName: `PF ${tag}`, email: `pf-${tag}-${stamp}@example.com`, locale: 'en', companyId: inCompany },
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
    hadForms = (await testApp.rawPrisma.formLayout.count({ where: { companyId } })) > 0;
    otherCompanyId = (
      await testApp.rawPrisma.company.create({
        data: { name: `PF Other ${stamp}`, slug: `pf-other-${stamp}` },
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
    if (!hadForms) await raw.formLayout.deleteMany({ where: { companyId } });
    else await raw.formLayout.deleteMany({ where: { companyId, name: { contains: stamp } } });
    await raw.formLayout.deleteMany({ where: { companyId: otherCompanyId } });
    await raw.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await raw.user.deleteMany({ where: { id: { in: userIds } } });
    await raw.company.deleteMany({ where: { id: otherCompanyId } });
    await testApp.close();
  });

  const ids: Record<string, string> = {};

  it('PF-1: the admin saves a booking form; the first of its kind is the default', async () => {
    if (!hadForms) {
      const r = await as(http().post('/v1/form-layouts'), adminToken).send(form()).expect(201);
      expect(r.body).toMatchObject({ documentType: 'RESERVATION', paperSize: 'A4', isDefault: true });
      ids.first = r.body.id;
    }
    // A second one, made the default, takes it over.
    const second = await as(http().post('/v1/form-layouts'), adminToken)
      .send(form({ name: `Form B ${stamp}`, isDefault: true, fields: [field('x', 'custom.marital_status')] }))
      .expect(201);
    ids.second = second.body.id;
    const list = await as(http().get('/v1/form-layouts?documentType=RESERVATION'), adminToken).expect(200);
    const defaults = (list.body as Array<{ id: string; isDefault: boolean }>).filter((f) => f.isDefault);
    expect(defaults.map((f) => f.id)).toEqual([ids.second]);
  });

  it('PF-2: a receipt prints on A4, A5 or half a sheet, and is not signed online', async () => {
    for (const paperSize of ['A4', 'A5', 'HALF']) {
      const r = await as(http().post('/v1/form-layouts'), adminToken)
        .send(
          form({
            documentType: 'RECEIPT',
            name: `Receipt ${paperSize} ${stamp}`,
            paperSize,
            pages: [page(3)],
            fields: [field('r', 'receipt.amount'), field('s', 'sign.stamp', { h: 0.1 })],
          }),
        )
        .expect(201);
      expect(r.body).toMatchObject({ documentType: 'RECEIPT', paperSize });
      ids[`receipt${paperSize}`] = r.body.id;
    }
    await as(http().post('/v1/form-layouts'), adminToken)
      .send(form({ documentType: 'RECEIPT', pages: [page(3)], fields: [field('c', 'sign.customer')] }))
      .expect(400);
    // The booking form is an A4 form.
    await as(http().post('/v1/form-layouts'), adminToken).send(form({ paperSize: 'A5' })).expect(400);
    await as(http().post('/v1/form-layouts'), adminToken).send(form({ paperSize: 'B5' })).expect(400);
  });

  it('PF-3: fields sit inside a page that exists', async () => {
    const bad = async (f: object) =>
      as(http().post('/v1/form-layouts'), adminToken).send(form({ fields: [f] })).expect(400);
    await bad(field('p', 'customer.name', { page: 2 }));
    await bad(field('p', 'customer.name', { x: 0.9, w: 0.3 }));
    await bad(field('p', 'customer.name', { y: 1.2 }));
    await bad(field('p', 'bad key!'));
    await as(http().post('/v1/form-layouts'), adminToken)
      .send(form({ fields: [field('d', 'customer.name'), field('d', 'customer.phone')] }))
      .expect(400);
  });

  it('PF-4: the document of a saved form stays as it was made', async () => {
    await as(http().put(`/v1/form-layouts/${ids.receiptA5}`), adminToken)
      .send(form({ documentType: 'RESERVATION', name: 'x', pages: [page(1)], fields: [] }))
      .expect(400);
    const r = await as(http().put(`/v1/form-layouts/${ids.receiptA5}`), adminToken)
      .send(form({ documentType: 'RECEIPT', name: `Receipt half ${stamp}`, paperSize: 'HALF', pages: [page(4)], fields: [] }))
      .expect(200);
    expect(r.body).toMatchObject({ name: `Receipt half ${stamp}`, paperSize: 'HALF', fields: [] });
  });

  it('PF-5: the staff read the forms; others neither read nor change them', async () => {
    await as(http().get('/v1/form-layouts'), tokens.sales).expect(200);
    await as(http().get(`/v1/form-layouts/${ids.second}`), tokens.sales).expect(200);
    await as(http().get('/v1/form-layouts'), tokens.customer).expect(403);
    await as(http().get('/v1/form-layouts'), tokens.broker).expect(403);
    await as(http().post('/v1/form-layouts'), tokens.sales).send(form()).expect(403);

    // Another company sees none of them and reaches none of them.
    const other = await as(http().get('/v1/form-layouts'), tokens.otherAdmin).expect(200);
    expect(other.body).toEqual([]);
    await as(http().get(`/v1/form-layouts/${ids.second}`), tokens.otherAdmin).expect(404);
    await as(http().put(`/v1/form-layouts/${ids.second}`), tokens.otherAdmin).send(form()).expect(404);
    await as(http().delete(`/v1/form-layouts/${ids.second}`), tokens.otherAdmin).expect(404);
    expect(await testApp.rawPrisma.formLayout.count({ where: { id: ids.second } })).toBe(1);
  });

  it('PF-7: a contract is a long A4 form, its customer signature box left for ink', async () => {
    const pages = Array.from({ length: 40 }, (_, i) => page(10 + i));
    const r = await as(http().post('/v1/form-layouts'), adminToken)
      .send(
        form({
          documentType: 'CONTRACT',
          name: `Contract ${stamp}`,
          pages,
          fields: [
            field('n', 'contract.number'),
            field('t', 'contract.totalWords', { page: 3 }),
            field('c', 'sign.customer', { page: 39, h: 0.06 }),
            field('s', 'sign.stamp', { page: 39, h: 0.1 }),
          ],
        }),
      )
      .expect(201);
    expect(r.body).toMatchObject({ documentType: 'CONTRACT', paperSize: 'A4' });
    expect(r.body.pages).toHaveLength(40);
    await as(http().post('/v1/form-layouts'), adminToken)
      .send(form({ documentType: 'CONTRACT', pages: [...pages, page(99)], fields: [] }))
      .expect(400);
    await as(http().post('/v1/form-layouts'), adminToken)
      .send(form({ documentType: 'CONTRACT', paperSize: 'A5', pages: [page(1)], fields: [] }))
      .expect(400);
  });

  it('PF-6: the admin deletes a form', async () => {
    await as(http().delete(`/v1/form-layouts/${ids.receiptA4}`), adminToken).expect(200);
    await as(http().get(`/v1/form-layouts/${ids.receiptA4}`), adminToken).expect(404);
  });
});
