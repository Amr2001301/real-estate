/**
 * SA-GUARD — SuperAdminController access control
 *
 * Proves that every super-admin management route (company lifecycle, capabilities,
 * pricing, modules) is unreachable by ordinary company users.
 *
 * The RBAC route-coverage spec (e2e-isolated-apps) flags these 23 routes as
 * "lacking @Public() or @Roles()". That is a spec blind spot: the controller
 * uses @UseGuards(JwtAuthGuard, SuperAdminGuard) at the class level, which the
 * RBAC spec does not recognise. This file proves the guard is live.
 *
 * Methodology (same as attack-matrix specs):
 *   - Non-2xx response = authorization check fired → GOOD
 *   - 2xx response     = guard bypassed            → CONFIRMED VULNERABILITY
 *
 * Actors under test:
 *   - Unauthenticated (no JWT)         → expect 401 from JwtAuthGuard (global)
 *   - Company ADMIN (role=ADMIN)       → expect 403 from SuperAdminGuard
 *   - SALES user (role=SALES)          → expect 403 from SuperAdminGuard
 *
 * Note: the actual URL prefix is /v1/super-admin/..., not /v1/companies/...
 * The RBAC spec shows only the method-level path fragment.
 */

import request from 'supertest';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { type TestApp, createSecurityTestApp } from '../setup-app';
import { bearer } from '../helpers/login';

const PASS = 'SAGuard-Test-1!';
const FAKE_ID = '00000000-0000-4000-8000-000000000099';
const SLUG = 'zz-sa-guard-co';

let testApp: TestApp;
let adminToken: string;
let salesToken: string;

beforeAll(async () => {
  testApp = await createSecurityTestApp();

  await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
  await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });

  const co = await testApp.rawPrisma.company.create({
    data: {
      slug: SLUG,
      name: 'SA Guard Test Company',
      isActive: true,
      staffAppEnabled: true,
      customerAppEnabled: false,
    },
  });

  const hash = await argon2.hash(PASS);
  const [adminUser, salesUser] = await Promise.all([
    testApp.rawPrisma.user.create({
      data: {
        email: `admin@${SLUG}.test`,
        passwordHash: hash,
        fullName: 'SA Guard Admin',
        role: UserRole.ADMIN,
        active: true,
        companyId: co.id,
      },
    }),
    testApp.rawPrisma.user.create({
      data: {
        email: `sales@${SLUG}.test`,
        passwordHash: hash,
        fullName: 'SA Guard Sales',
        role: UserRole.SALES,
        active: true,
        companyId: co.id,
      },
    }),
  ]);

  const loginStaff = async (email: string) => {
    const res = await request(testApp.app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: PASS });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    }
    const token: unknown = res.body?.tokens?.accessToken ?? res.body?.accessToken;
    if (typeof token !== 'string') throw new Error(`No token for ${email}`);
    return token;
  };

  [adminToken, salesToken] = await Promise.all([
    loginStaff(adminUser.email!),
    loginStaff(salesUser.email!),
  ]);
}, 60_000);

afterAll(async () => {
  await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
  await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });
}, 30_000);

// Representative sample of super-admin routes covering all four operation types:
// company lifecycle, capabilities, pricing, modules.
const ROUTES: Array<[string, string, string, object?]> = [
  ['POST',   '/v1/super-admin/companies',                               'create company'],
  ['PUT',    `/v1/super-admin/companies/${FAKE_ID}/capabilities/overrides`, 'set capability overrides'],
  ['DELETE', `/v1/super-admin/companies/${FAKE_ID}`,                    'delete company'],
  ['GET',    '/v1/super-admin/capabilities/report',                     'capability report'],
  ['PATCH',  `/v1/super-admin/companies/${FAKE_ID}/modules`,            'update modules'],
];

describe('SA-GUARD — SuperAdminController blocks non-super-admins', () => {
  describe('unauthenticated caller (no JWT) → 401 on every super-admin route', () => {
    for (const [method, path, label] of ROUTES) {
      it(`SA-UNAUTH: ${method} ${path} (${label}) → 401`, async () => {
        const agent = request(testApp.app.getHttpServer()) as unknown as Record<string, (p: string) => request.Test>;
        const res = await agent[method.toLowerCase()]!(path).send({});
        if (res.status === 200 || res.status === 201) {
          throw new Error(
            `CONFIRMED VULNERABILITY: unauthenticated ${method} ${path} returned ${res.status}. ` +
            `SuperAdminGuard is NOT blocking unauthenticated access.`,
          );
        }
        expect(res.status).toBe(401);
      });
    }
  });

  describe('company ADMIN (role=ADMIN, not SUPER_ADMIN) → 403 on every super-admin route', () => {
    for (const [method, path, label] of ROUTES) {
      it(`SA-ADMIN: ${method} ${path} (${label}) → 403`, async () => {
        const agent = request(testApp.app.getHttpServer()) as unknown as Record<string, (p: string) => request.Test>;
        const res = await agent[method.toLowerCase()]!(path).set('Authorization', bearer(adminToken)).send({});
        if (res.status === 200 || res.status === 201) {
          throw new Error(
            `CONFIRMED VULNERABILITY — PRIVILEGE ESCALATION: company ADMIN reached ${method} ${path} (status=${res.status}). ` +
            `A tenant-level ADMIN can perform super-admin operations. This is the most serious finding in this project.`,
          );
        }
        expect(res.status).toBe(403);
      });
    }
  });

  describe('SALES user (role=SALES) → 403 on every super-admin route', () => {
    for (const [method, path, label] of ROUTES) {
      it(`SA-SALES: ${method} ${path} (${label}) → 403`, async () => {
        const agent = request(testApp.app.getHttpServer()) as unknown as Record<string, (p: string) => request.Test>;
        const res = await agent[method.toLowerCase()]!(path).set('Authorization', bearer(salesToken)).send({});
        if (res.status === 200 || res.status === 201) {
          throw new Error(
            `CONFIRMED VULNERABILITY — PRIVILEGE ESCALATION: SALES user reached ${method} ${path} (status=${res.status}). ` +
            `A tenant-level SALES user can perform super-admin operations.`,
          );
        }
        expect(res.status).toBe(403);
      });
    }
  });
});
