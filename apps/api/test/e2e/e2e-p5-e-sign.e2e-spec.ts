/**
 * P5 — the customer signs the booking form online. The staff send a link; the
 * customer reads the form as sent, proves the phone on file with a code and
 * signs by hand. The link is the company's (another company's website does
 * not open it), works once, and stops working when cancelled, replaced or
 * expired. A change to the booking after signing shows the signature is on an
 * older version.
 */
import 'reflect-metadata';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { ReservationStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

/** A 1×1 PNG, as the signing page sends it. */
const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SNAPSHOT = { version: 1, title: 'استمارة حجز', sections: [], amounts: [], clauses: [] };

describe('P5 — customer e-signature on the booking form (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId = '';
  let slug = '';
  let otherCompanyId = '';
  let clientId = '';
  const reservationIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const pub = <T extends request.Test>(r: T, tenant = slug) => r.set('X-Tenant-Slug', tenant);
  const tokenOf = (url: string) => url.split('/sign/')[1]!;
  /** The code the SMS would carry: set on the request, as the test cannot read the SMS. */
  const knownCode = async (token: string, code = '123456') => {
    await testApp.rawPrisma.signatureRequest.updateMany({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      data: { otpHash: createHash('sha256').update(code).digest('hex') },
    });
    return code;
  };

  const newBooking = async () => {
    const raw = testApp.rawPrisma;
    const unit = await raw.unit.findFirstOrThrow({ where: { companyId }, select: { id: true } });
    const r = await raw.reservation.create({
      data: {
        companyId,
        unitId: unit.id,
        salesId: fixtures.userIds.salesId,
        clientId,
        status: ReservationStatus.APPROVED,
        bookingAmount: 50_000,
        expiresAt: new Date(Date.now() + 3 * 86_400_000),
      },
      select: { id: true },
    });
    reservationIds.push(r.id);
    return r.id;
  };
  const send = (reservationId: string) =>
    asAdmin(http().post(`/v1/reservations/${reservationId}/signature-requests`)).send({ snapshot: SNAPSHOT });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    slug = (await raw.company.findUniqueOrThrow({ where: { id: companyId } })).slug;
    clientId = (
      await raw.user.create({
        data: { role: UserRole.CUSTOMER, fullName: 'P5 Buyer', phone: `+2010${stamp}9`.slice(0, 13), companyId, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    otherCompanyId = (await raw.company.create({ data: { name: `P5 Other ${stamp}`, slug: `p5-other-${stamp}` } })).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.signatureRequest.deleteMany({ where: { documentId: { in: reservationIds } } });
    await raw.reservationActivity.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: reservationIds } } });
    await raw.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    await raw.user.deleteMany({ where: { id: clientId } });
    await raw.company.deleteMany({ where: { id: otherCompanyId } });
    await testApp.close();
  });

  it('P5-1: staff send a link; the customer reads the form as sent', async () => {
    const id = await newBooking();
    const res = await send(id).expect(201);
    expect(res.body.url).toMatch(/\/sign\/[A-Za-z0-9_-]{40,}$/);
    expect(res.body.state).toBe('PENDING');
    // Only the link's hash is kept.
    const stored = await testApp.rawPrisma.signatureRequest.findFirstOrThrow({ where: { documentId: id } });
    expect(stored.tokenHash).not.toContain(tokenOf(res.body.url));

    const view = await pub(http().get(`/v1/public/e-sign/${tokenOf(res.body.url)}`)).expect(200);
    expect(view.body.snapshot).toEqual(SNAPSHOT);
    expect(view.body.state).toBe('PENDING');
    expect(view.body.phone).toMatch(/•••/);
    expect(view.body.phone).not.toContain(stamp);
  });

  it('P5-2: the code goes to the phone on file; a wrong code is refused; the right one signs, once', async () => {
    const id = await newBooking();
    const token = tokenOf((await send(id).expect(201)).body.url);

    // Signing without asking for a code first is refused.
    await pub(http().post(`/v1/public/e-sign/${token}/sign`)).send({ code: '123456', name: 'P5 Buyer', signature: SIGNATURE }).expect(400);

    await pub(http().post(`/v1/public/e-sign/${token}/code`)).send({}).expect(201);
    // A second code within the minute is refused.
    await pub(http().post(`/v1/public/e-sign/${token}/code`)).send({}).expect(400);
    const code = await knownCode(token);

    await pub(http().post(`/v1/public/e-sign/${token}/sign`)).send({ code: '000000', name: 'P5 Buyer', signature: SIGNATURE }).expect(400);
    await pub(http().post(`/v1/public/e-sign/${token}/sign`))
      .set('User-Agent', 'P5-test-agent')
      .send({ code, name: 'P5 Buyer', signature: SIGNATURE })
      .expect(201);

    const signed = await testApp.rawPrisma.signatureRequest.findFirstOrThrow({ where: { documentId: id } });
    expect(signed.status).toBe('SIGNED');
    expect(signed.signerName).toBe('P5 Buyer');
    expect(signed.signerUserAgent).toBe('P5-test-agent');
    expect(signed.otpHash).toBeNull();

    // The link works once.
    await pub(http().post(`/v1/public/e-sign/${token}/sign`)).send({ code, name: 'x y', signature: SIGNATURE }).expect(409);

    // The staff see the signature.
    const list = await asAdmin(http().get(`/v1/reservations/${id}/signature-requests`)).expect(200);
    expect(list.body[0]).toMatchObject({ state: 'SIGNED', signerName: 'P5 Buyer', outdated: false });
    expect(list.body[0].signature).toMatch(/^data:image\/png;base64,/);
  });

  it('P5-3: five wrong codes lock the code', async () => {
    const id = await newBooking();
    const token = tokenOf((await send(id).expect(201)).body.url);
    await pub(http().post(`/v1/public/e-sign/${token}/code`)).send({}).expect(201);
    const code = await knownCode(token);
    for (let i = 0; i < 5; i++) {
      await pub(http().post(`/v1/public/e-sign/${token}/sign`)).send({ code: '000000', name: 'P5 Buyer', signature: SIGNATURE }).expect(400);
    }
    await pub(http().post(`/v1/public/e-sign/${token}/sign`)).send({ code, name: 'P5 Buyer', signature: SIGNATURE }).expect(403);
  });

  it('P5-4: another company’s website does not open the link', async () => {
    const id = await newBooking();
    const token = tokenOf((await send(id).expect(201)).body.url);
    const other = (await testApp.rawPrisma.company.findUniqueOrThrow({ where: { id: otherCompanyId } })).slug;
    await pub(http().get(`/v1/public/e-sign/${token}`), other).expect(404);
    await pub(http().post(`/v1/public/e-sign/${token}/code`), other).send({}).expect(404);
  });

  it('P5-5: a new link replaces the open one; a cancelled or expired link is closed', async () => {
    const id = await newBooking();
    const first = tokenOf((await send(id).expect(201)).body.url);
    const second = tokenOf((await send(id).expect(201)).body.url);
    expect((await pub(http().get(`/v1/public/e-sign/${first}`)).expect(200)).body.state).toBe('CANCELLED');
    await pub(http().post(`/v1/public/e-sign/${first}/code`)).send({}).expect(410);

    const list = await asAdmin(http().get(`/v1/reservations/${id}/signature-requests`)).expect(200);
    await asAdmin(http().delete(`/v1/signature-requests/${list.body[0].id}`)).expect(200);
    await pub(http().post(`/v1/public/e-sign/${second}/code`)).send({}).expect(410);

    const third = tokenOf((await send(id).expect(201)).body.url);
    await testApp.rawPrisma.signatureRequest.updateMany({
      where: { tokenHash: createHash('sha256').update(third).digest('hex') },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await pub(http().get(`/v1/public/e-sign/${third}`)).expect(200)).body.state).toBe('EXPIRED');
    await pub(http().post(`/v1/public/e-sign/${third}/code`)).send({}).expect(410);
  });

  it('P5-6: a change to the booking after signing shows the signature is on an older version', async () => {
    const id = await newBooking();
    const token = tokenOf((await send(id).expect(201)).body.url);
    await pub(http().post(`/v1/public/e-sign/${token}/code`)).send({}).expect(201);
    await pub(http().post(`/v1/public/e-sign/${token}/sign`))
      .send({ code: await knownCode(token), name: 'P5 Buyer', signature: SIGNATURE })
      .expect(201);
    await testApp.rawPrisma.reservation.update({ where: { id }, data: { bookingAmount: 75_000 } });
    const list = await asAdmin(http().get(`/v1/reservations/${id}/signature-requests`)).expect(200);
    expect(list.body[0]).toMatchObject({ state: 'SIGNED', outdated: true });
  });

  it('P5-7: a booking that is over, or a customer without a phone, cannot be sent', async () => {
    const id = await newBooking();
    await testApp.rawPrisma.reservation.update({ where: { id }, data: { status: ReservationStatus.CANCELLED } });
    await send(id).expect(409);

    const noPhone = await newBooking();
    await testApp.rawPrisma.user.update({ where: { id: clientId }, data: { phone: null } });
    try {
      await send(noPhone).expect(400);
    } finally {
      await testApp.rawPrisma.user.update({ where: { id: clientId }, data: { phone: `+2010${stamp}9`.slice(0, 13) } });
    }
  });

  it('P5-8: a bad link, or a signature that is not a PNG, is refused', async () => {
    await pub(http().get('/v1/public/e-sign/not-a-token')).expect(404);
    await pub(http().get(`/v1/public/e-sign/${'x'.repeat(43)}`)).expect(404);

    const id = await newBooking();
    const token = tokenOf((await send(id).expect(201)).body.url);
    await pub(http().post(`/v1/public/e-sign/${token}/code`)).send({}).expect(201);
    const code = await knownCode(token);
    const jpeg = `data:image/png;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]).toString('base64')}`;
    await pub(http().post(`/v1/public/e-sign/${token}/sign`)).send({ code, name: 'P5 Buyer', signature: jpeg }).expect(400);
  });
});
