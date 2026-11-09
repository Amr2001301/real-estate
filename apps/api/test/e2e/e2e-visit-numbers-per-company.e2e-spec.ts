/**
 * F-078 — visit request and visit appointment numbers belong to a company.
 *
 * Their unique indexes spanned every company, so once one company held
 * VA-2026-0001 no other company could schedule a visit (every try was a 500),
 * and the visit requests that came from the website or from a broker were saved
 * without any number at all.
 */
import 'reflect-metadata';
import * as argon2 from 'argon2';
import request from 'supertest';
import { ProjectStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer } from '../helpers/login';

describe('F-078 — visit numbers are per company (e2e)', () => {
  let testApp: TestApp;
  let adminA: string;
  let adminB: string;
  let companyA = '';
  let companyB = '';
  let slugA = '';
  let projectA = '';
  let projectB = '';
  let adminAId = '';
  let adminBId = '';
  const stamp = Date.now().toString().slice(-8);
  const http = () => request(testApp.app.getHttpServer());
  const day = (n: number) => {
    const d = new Date(Date.now() + n * 864e5);
    d.setUTCHours(10, 0, 0, 0);
    return d.toISOString();
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    const raw = testApp.rawPrisma;
    // Two fresh companies, so each one starts counting from its own first number.
    companyA = (await raw.company.create({ data: { name: `F78 A ${stamp}`, slug: `f78-a-${stamp}`, isActive: true }, select: { id: true } })).id;
    slugA = `f78-a-${stamp}`;
    adminAId = (
      await raw.user.create({
        data: { companyId: companyA, role: UserRole.ADMIN, fullName: 'F78 Admin A', email: `f78-a-${stamp}@example.com`, passwordHash: await argon2.hash('StrongPass1!'), locale: 'ar' },
        select: { id: true },
      })
    ).id;
    adminA = await testApp.signAccessToken(adminAId, 'ADMIN');
    projectA = (
      await raw.project.create({
        data: { companyId: companyA, code: `F78-A-${stamp}`, name: { ar: 'أ', en: 'A' }, description: { ar: 'و', en: 'd' }, city: 'Cairo', lat: 30, lng: 31, status: ProjectStatus.PUBLISHED },
        select: { id: true },
      })
    ).id;
    companyB = (await raw.company.create({ data: { name: `F78 B ${stamp}`, slug: `f78-b-${stamp}`, isActive: true }, select: { id: true } })).id;
    adminBId = (
      await raw.user.create({
        data: { companyId: companyB, role: UserRole.ADMIN, fullName: 'F78 Admin B', email: `f78-b-${stamp}@example.com`, passwordHash: await argon2.hash('StrongPass1!'), locale: 'ar' },
        select: { id: true },
      })
    ).id;
    adminB = await testApp.signAccessToken(adminBId, 'ADMIN');
    projectB = (
      await raw.project.create({
        data: { companyId: companyB, code: `F78-B-${stamp}`, name: { ar: 'ب', en: 'B' }, description: { ar: 'و', en: 'd' }, city: 'Cairo', lat: 30, lng: 31, status: ProjectStatus.PUBLISHED },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const requests = { companyId: { in: [companyA, companyB] }, customerName: { startsWith: 'F78' } };
    await raw.visitActivity.deleteMany({ where: { visitRequest: requests } }).catch(() => void 0);
    await raw.visitAppointment.deleteMany({ where: { visitRequest: requests } }).catch(() => void 0);
    await raw.visitRequest.deleteMany({ where: requests }).catch(() => void 0);
    await raw.lead.deleteMany({ where: { fullName: { startsWith: 'F78' } } }).catch(() => void 0);
    await raw.notification.deleteMany({ where: { companyId: { in: [companyA, companyB] }, createdAt: { gt: new Date(Date.now() - 3_600_000) } } }).catch(() => void 0);
    await raw.project.deleteMany({ where: { id: { in: [projectA, projectB] } } }).catch(() => void 0);
    await raw.user.deleteMany({ where: { id: { in: [adminAId, adminBId] } } }).catch(() => void 0);
    await raw.company.deleteMany({ where: { id: { in: [companyA, companyB] } } }).catch(() => void 0);
  });

  const direct = (token: string, projectId: string, n: number, name: string) =>
    http()
      .post('/v1/visits/appointments')
      .set('Authorization', bearer(token))
      .send({ projectId, scheduledAt: day(10 + n), customerName: name, customerPhone: `+2010${stamp}${n}`.slice(0, 13) });

  it('F78-1: two companies each get their own VA-/VR- numbers, and the second one is not refused', async () => {
    const a = await direct(adminA, projectA, 1, 'F78 Client A');
    expect(a.status).toBe(201);
    const b = await direct(adminB, projectB, 2, 'F78 Client B');
    expect(b.status).toBe(201); // was a 500: VA-… already belonged to the other company
    const b2 = await direct(adminB, projectB, 3, 'F78 Client B2');
    expect(b2.status).toBe(201);
    expect(a.body.visitNumber).toMatch(/^VA-\d{4}-\d{4}$/);
    expect(b2.body.visitNumber).not.toBe(b.body.visitNumber);
    // Each company counts from its own first number: both hold the same VA-…-0001.
    expect(a.body.visitNumber).toMatch(/-0001$/);
    expect(b.body.visitNumber).toBe(a.body.visitNumber);
    expect(b2.body.visitNumber).toMatch(/-0002$/);
  });

  it('F78-2: a visit request from the website gets a number too', async () => {
    const res = await http()
      .post('/v1/public/visit-request')
      .set('X-Tenant-Slug', slugA)
      .send({ projectId: projectA, preferredDate: day(20), name: 'F78 Web Guest', phone: `+2011${stamp}1`.slice(0, 13), email: `f78-web-${stamp}@example.com` });
    expect(res.status).toBeLessThan(300);
    const row = await testApp.rawPrisma.visitRequest.findFirstOrThrow({ where: { companyId: companyA, customerName: 'F78 Web Guest' } });
    expect(row.requestNumber).toMatch(/^VR-\d{4}-\d{4}$/);
  });
});
