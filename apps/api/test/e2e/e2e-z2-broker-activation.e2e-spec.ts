/**
 * Z2 — broker activation. A firm is created "قيد الانضمام" (PENDING) and its
 * agent "مدعو" (INVITED), even when the admin sets the agent's password.
 * Nothing ever turned INVITED into ACTIVE, so after the admin activated the
 * firm the agent was still refused on every portal page ("ليست لديك صلاحية
 * الوصول إلى هذا المورد"), with nothing saying why. An invited agent now
 * joins by signing in, and a firm still pending says so in Arabic.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';

describe('Z2 — broker activation (e2e)', () => {
  let testApp: TestApp;
  let adminToken: string;
  let brokerId = '';
  let brokerUserId = '';
  let agentUserId = '';
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const portalMe = async () =>
    http()
      .get('/v1/portal/me')
      .set('Authorization', bearer(await testApp.signAccessToken(agentUserId, 'BROKER')));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const firm = await asAdmin(http().post('/v1/brokers'))
      .send({ companyName: `Z2 Brokerage ${stamp}` })
      .expect(201);
    brokerId = firm.body.id;
    expect(firm.body.status).toBe('PENDING');
    const agent = await asAdmin(http().post(`/v1/brokers/${brokerId}/users`))
      .send({
        fullName: 'Z2 Agent',
        email: `z2-agent-${stamp}@example.com`,
        password: 'Z2AgentPass123!',
      })
      .expect(201);
    brokerUserId = agent.body.id;
    agentUserId = agent.body.userId;
    expect(agent.body.status).toBe('INVITED');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.notification.deleteMany({ where: { userId: agentUserId } });
    await raw.auditLog.deleteMany({
      where: { entityId: { in: [brokerId, brokerUserId, agentUserId] } },
    });
    await raw.brokerUser.deleteMany({ where: { id: brokerUserId } });
    await raw.user.deleteMany({ where: { id: agentUserId } });
    await raw.broker.deleteMany({ where: { id: brokerId } });
  });

  it('Z2-1: while the firm is pending the portal says so, in Arabic', async () => {
    const res = await portalMe();
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BROKER_FIRM_NOT_ACTIVE');
    expect(res.body.message).toContain('لم تُفعَّل بعد');
  });

  it('Z2-2: once the firm is active, the invited agent signs in and has joined', async () => {
    await asAdmin(http().patch(`/v1/brokers/${brokerId}/status`))
      .send({ status: 'ACTIVE' })
      .expect(200);

    expect((await portalMe()).status).toBe(200);
    const link = await testApp.rawPrisma.brokerUser.findUniqueOrThrow({
      where: { id: brokerUserId },
    });
    expect(link.status).toBe('ACTIVE');
    expect(link.joinedAt).not.toBeNull();
  });

  it('Z2-3: a suspended agent stays out', async () => {
    await testApp.rawPrisma.brokerUser.update({
      where: { id: brokerUserId },
      data: { status: 'SUSPENDED' },
    });
    const res = await portalMe();
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BROKER_USER_NOT_ACTIVE');
  });
});
