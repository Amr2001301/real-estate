/**
 * Customer extra data. Beyond the identity, the company keeps fixed personal
 * details on a buyer and its own extra fields, all printed on its forms. The
 * staff fill them; the buyer cannot change them from their profile, and one
 * company's fields are never another's.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';

describe('Customer extra data — fixed and company fields (e2e)', () => {
  let testApp: TestApp;
  let adminToken: string;
  let companyId = '';
  let otherCompanyId = '';
  let customerId = '';
  const userIds: string[] = [];
  const fieldIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);
  const tokens: Record<'sales' | 'customer' | 'broker' | 'otherAdmin', string> = {
    sales: '',
    customer: '',
    broker: '',
    otherAdmin: '',
  };
  const fields: Record<'spouse' | 'kind' | 'children' | 'married', { id: string; key: string }> = {} as never;

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(r: T, token: string) => r.set('Authorization', bearer(token));

  const makeUser = async (role: UserRole, inCompany: string, tag: string) => {
    const u = await testApp.rawPrisma.user.create({
      data: { role, fullName: `CF ${tag}`, email: `cf-${tag}-${stamp}@example.com`, locale: 'en', companyId: inCompany },
      select: { id: true },
    });
    userIds.push(u.id);
    return { id: u.id, token: await testApp.signAccessToken(u.id, role) };
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const admin = await testApp.rawPrisma.user.findFirstOrThrow({
      where: { email: 'admin@example.com', role: UserRole.ADMIN },
      select: { companyId: true },
    });
    companyId = admin.companyId!;
    otherCompanyId = (
      await testApp.rawPrisma.company.create({
        data: { name: `CF Other ${stamp}`, slug: `cf-other-${stamp}` },
        select: { id: true },
      })
    ).id;

    tokens.sales = (await makeUser(UserRole.SALES, companyId, 'sales')).token;
    const customer = await makeUser(UserRole.CUSTOMER, companyId, 'customer');
    customerId = customer.id;
    tokens.customer = customer.token;
    tokens.broker = (await makeUser(UserRole.BROKER, companyId, 'broker')).token;
    tokens.otherAdmin = (await makeUser(UserRole.ADMIN, otherCompanyId, 'other-admin')).token;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.customerField.deleteMany({ where: { OR: [{ id: { in: fieldIds } }, { companyId: otherCompanyId }] } });
    await raw.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await raw.user.deleteMany({ where: { id: { in: userIds } } });
    await raw.company.deleteMany({ where: { id: otherCompanyId } });
    await testApp.close();
  });

  it('CF-1: the admin defines the company’s fields; the key comes from the English label', async () => {
    const create = async (body: object, key: keyof typeof fields) => {
      const r = await as(http().post('/v1/customer-fields'), adminToken).send(body).expect(201);
      fieldIds.push(r.body.id);
      fields[key] = { id: r.body.id, key: r.body.key };
      return r.body;
    };
    const spouse = await create({ ar: 'اسم الزوج/الزوجة', en: `Spouse name ${stamp}`, type: 'TEXT' }, 'spouse');
    expect(spouse).toMatchObject({ key: `spouse_name_${stamp}`, type: 'TEXT', active: true, options: [] });

    // The same label again steps aside to a free key.
    const again = await as(http().post('/v1/customer-fields'), adminToken)
      .send({ ar: 'اسم الزوج', en: `Spouse name ${stamp}`, type: 'TEXT' })
      .expect(201);
    fieldIds.push(again.body.id);
    expect(again.body.key).toBe(`spouse_name_${stamp}_2`);

    const kind = await create(
      { ar: 'نوع العميل', en: 'Kind', key: `kind_${stamp}`, type: 'SELECT', options: [' فرد ', 'شركة'] },
      'kind',
    );
    expect(kind.options).toEqual(['فرد', 'شركة']);
    await create({ ar: 'عدد الأبناء', en: 'Children', key: `children_${stamp}`, type: 'NUMBER' }, 'children');
    await create({ ar: 'تاريخ الزواج', en: 'Married on', key: `married_${stamp}`, type: 'DATE' }, 'married');

    // A chosen key is not taken twice; a list field needs its choices.
    await as(http().post('/v1/customer-fields'), adminToken)
      .send({ ar: 'x', en: 'x', key: `kind_${stamp}`, type: 'TEXT' })
      .expect(409);
    await as(http().post('/v1/customer-fields'), adminToken).send({ ar: 'x', en: 'x', type: 'SELECT' }).expect(400);
    await as(http().post('/v1/customer-fields'), adminToken)
      .send({ ar: 'x', en: 'x', key: 'Bad Key', type: 'TEXT' })
      .expect(400);
    await as(http().post('/v1/customer-fields'), adminToken).send({ ar: 'x', en: 'x', type: 'IMAGE' }).expect(400);
  });

  it('CF-2: the staff read them; others neither read nor change them', async () => {
    const list = await as(http().get('/v1/customer-fields'), tokens.sales).expect(200);
    expect(list.body.map((f: { key: string }) => f.key)).toEqual(expect.arrayContaining([fields.spouse.key, fields.kind.key]));

    await as(http().get('/v1/customer-fields'), tokens.customer).expect(403);
    await as(http().get('/v1/customer-fields'), tokens.broker).expect(403);
    await as(http().post('/v1/customer-fields'), tokens.sales).send({ ar: 'x', en: 'x', type: 'TEXT' }).expect(403);

    // Another company sees none of them and cannot change them.
    const other = await as(http().get('/v1/customer-fields'), tokens.otherAdmin).expect(200);
    expect(other.body.map((f: { id: string }) => f.id)).not.toEqual(expect.arrayContaining([fields.spouse.id]));
    await as(http().patch(`/v1/customer-fields/${fields.spouse.id}`), tokens.otherAdmin).send({ active: false }).expect(404);
  });

  it('CF-3: staff record the fixed details and the company’s fields on a customer', async () => {
    const r = await as(http().patch(`/v1/users/${customerId}`), adminToken)
      .send({
        birthDate: '1990-05-17',
        birthPlace: ' المنصورة ',
        occupation: 'مهندس',
        employer: 'شركة النيل',
        nationalIdIssueDate: '2020-01-02',
        nationalIdIssuePlace: 'سجل مدني مدينة نصر',
        homePhone: '02 2260 1234',
        customFields: {
          [fields.spouse.key]: ' منى أحمد ',
          [fields.kind.key]: 'فرد',
          [fields.children.key]: '3',
          [fields.married.key]: '2015-09-01',
        },
      })
      .expect(200);
    expect(r.body).toMatchObject({
      birthPlace: 'المنصورة',
      occupation: 'مهندس',
      employer: 'شركة النيل',
      nationalIdIssuePlace: 'سجل مدني مدينة نصر',
      homePhone: '02 2260 1234',
      customFields: {
        [fields.spouse.key]: 'منى أحمد',
        [fields.kind.key]: 'فرد',
        [fields.children.key]: 3,
        [fields.married.key]: '2015-09-01',
      },
    });
    expect(String(r.body.birthDate).slice(0, 10)).toBe('1990-05-17');
    expect(String(r.body.nationalIdIssueDate).slice(0, 10)).toBe('2020-01-02');

    // One field changed or cleared leaves the others as they are.
    const next = await as(http().patch(`/v1/users/${customerId}`), adminToken)
      .send({ customFields: { [fields.children.key]: 4, [fields.married.key]: null } })
      .expect(200);
    expect(next.body.customFields).toEqual({
      [fields.spouse.key]: 'منى أحمد',
      [fields.kind.key]: 'فرد',
      [fields.children.key]: 4,
    });
  });

  it('CF-4: values are checked against the company’s fields', async () => {
    const send = (body: object) => as(http().patch(`/v1/users/${customerId}`), adminToken).send(body);
    await send({ customFields: { [fields.kind.key]: 'جمعية' } }).expect(400);
    await send({ customFields: { [fields.children.key]: 'ثلاثة' } }).expect(400);
    await send({ customFields: { [fields.married.key]: '2015-02-30' } }).expect(400);
    await send({ customFields: { no_such_field: 'x' } }).expect(400);
    await send({ customFields: { [fields.spouse.key]: 'x'.repeat(301) } }).expect(400);
    await send({ birthDate: '2999-01-01' }).expect(400);
    await send({ birthDate: '17/05/1990' }).expect(400);
    await send({ homePhone: 'call me' }).expect(400);

    // Another company's field is not this company's.
    const foreign = await testApp.rawPrisma.customerField.create({
      data: { companyId: otherCompanyId, key: `foreign_${stamp}`, label: { ar: 'x', en: 'x' }, type: 'TEXT' },
      select: { key: true },
    });
    await send({ customFields: { [foreign.key]: 'x' } }).expect(400);
  });

  it('CF-5: a field turned off keeps its values and takes no new one', async () => {
    await as(http().patch(`/v1/customer-fields/${fields.spouse.id}`), adminToken).send({ active: false }).expect(200);
    const r = await as(http().patch(`/v1/users/${customerId}`), adminToken)
      .send({ customFields: { [fields.spouse.key]: 'غيرها' } })
      .expect(200);
    expect(r.body.customFields[fields.spouse.key]).toBe('منى أحمد');

    // The key and the type stay; the label and the choices change.
    await as(http().patch(`/v1/customer-fields/${fields.kind.id}`), adminToken)
      .send({ key: 'renamed', type: 'TEXT' })
      .expect(400);
    const ok = await as(http().patch(`/v1/customer-fields/${fields.kind.id}`), adminToken)
      .set('x-raw-translatable', '1')
      .send({ ar: 'صفة العميل', options: ['فرد', 'شركة', 'جهة حكومية'] })
      .expect(200);
    expect(ok.body).toMatchObject({ key: fields.kind.key, type: 'SELECT', label: { ar: 'صفة العميل', en: 'Kind' } });
    await as(http().patch(`/v1/customer-fields/${fields.spouse.id}`), adminToken).send({ options: ['a'] }).expect(400);
  });

  it('CF-6: the buyer cannot change any of it from their own profile', async () => {
    const before = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: customerId } });
    await as(http().patch('/v1/users/me'), tokens.customer)
      .send({
        birthDate: '2000-01-01',
        occupation: 'x',
        homePhone: '0000000',
        nationalIdIssuePlace: 'x',
        customFields: { [fields.kind.key]: 'شركة' },
      })
      .expect(200);
    const after = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect({
      birthDate: after.birthDate,
      occupation: after.occupation,
      homePhone: after.homePhone,
      nationalIdIssuePlace: after.nationalIdIssuePlace,
      customFields: after.customFields,
    }).toEqual({
      birthDate: before.birthDate,
      occupation: before.occupation,
      homePhone: before.homePhone,
      nationalIdIssuePlace: before.nationalIdIssuePlace,
      customFields: before.customFields,
    });
  });
});
