/**
 * CC3 — F4. A company created on the Professional plan was stored with
 * status TRIAL and listed as «تجريبي». A paid plan is a subscription: the
 * company starts ACTIVE, and moving a trial company onto a paid plan ends
 * its trial.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer } from '../helpers/login';

describe('CC3 — paid plan status (e2e)', () => {
  let testApp: TestApp;
  let superId = '';
  let superToken = '';
  const companyIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const createCompany = async (slug: string, subscriptionPlan?: string) => {
    const res = await http()
      .post('/v1/super-admin/companies')
      .set('Authorization', bearer(superToken))
      .send({ name: `CC3 ${slug}`, slug: `cc3-${slug}-${stamp}`, country: 'EG', subscriptionPlan })
      .expect(201);
    companyIds.push(res.body.company.id);
    return res.body.company as { id: string; subscriptionStatus: string };
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    superId = (
      await testApp.rawPrisma.user.create({
        data: {
          role: UserRole.SUPER_ADMIN,
          fullName: 'CC3 Platform',
          email: `cc3-super-${stamp}@example.com`,
          locale: 'en',
        },
        select: { id: true },
      })
    ).id;
    superToken = await testApp.signAccessToken(superId, 'SUPER_ADMIN');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.leadSource.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.setting.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.companyDomain.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.company.deleteMany({ where: { id: { in: companyIds } } });
    await raw.user.deleteMany({ where: { id: superId } });
  });

  it('CC3-1: a company created on a paid plan is ACTIVE, a trial one is TRIAL', async () => {
    expect((await createCompany('pro', 'PROFESSIONAL')).subscriptionStatus).toBe('ACTIVE');
    expect((await createCompany('trial')).subscriptionStatus).toBe('TRIAL');
  });

  it('CC3-2: moving a trial company onto a paid plan ends the trial', async () => {
    const company = await createCompany('upgrade');
    const res = await http()
      .patch(`/v1/super-admin/companies/${company.id}`)
      .set('Authorization', bearer(superToken))
      .send({ subscriptionPlan: 'STARTER' })
      .expect(200);
    expect(res.body.subscriptionStatus).toBe('ACTIVE');
  });
});
