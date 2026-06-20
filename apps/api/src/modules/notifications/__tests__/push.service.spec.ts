import { PushService } from '../push.service';
import { FirebaseService } from '../../../common/firebase/firebase.service';

function makePrisma() {
  return {
    deviceToken: { findMany: jest.fn(), deleteMany: jest.fn() },
  };
}

describe('PushService', () => {
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('is a safe no-op when FCM is disabled', async () => {
    const firebase = { messaging: () => null } as unknown as FirebaseService;
    const svc = new PushService(prisma as never, firebase);
    const result = await svc.sendToUser('u1', { title: 't', body: 'b' });
    expect(result.enabled).toBe(false);
    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
  });

  it('sends to all tokens and prunes unregistered ones', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([
      { token: 'good' },
      { token: 'dead' },
    ]);
    prisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

    const sendEachForMulticast = jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
      ],
    });
    const firebase = {
      messaging: () => ({ sendEachForMulticast }),
    } as unknown as FirebaseService;

    const svc = new PushService(prisma as never, firebase);
    const result = await svc.sendToUser('u1', { title: 't', body: 'b' });

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ enabled: true, sent: 1, failed: 1, pruned: 1 });
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['dead'] } },
    });
  });

  it('does nothing when the user has no devices', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([]);
    const firebase = {
      messaging: () => ({ sendEachForMulticast: jest.fn() }),
    } as unknown as FirebaseService;
    const svc = new PushService(prisma as never, firebase);
    const result = await svc.sendToUser('u1', { title: 't', body: 'b' });
    expect(result.sent).toBe(0);
  });

  // ── pushEnabled getter ──────────────────────────────────────────────────────

  it('pushEnabled is false when Firebase is not configured', () => {
    const firebase = { enabled: false, messaging: () => null } as unknown as FirebaseService;
    const svc = new PushService(prisma as never, firebase);
    expect(svc.pushEnabled).toBe(false);
  });

  it('pushEnabled is true when Firebase is configured', () => {
    const firebase = {
      enabled: true,
      messaging: () => ({ sendEachForMulticast: jest.fn() }),
    } as unknown as FirebaseService;
    const svc = new PushService(prisma as never, firebase);
    expect(svc.pushEnabled).toBe(true);
  });

  // ── FCM data passthrough ────────────────────────────────────────────────────

  it('passes data payload to sendEachForMulticast', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'tok' }]);
    const sendEachForMulticast = jest.fn().mockResolvedValue({
      successCount: 1, failureCount: 0, responses: [{ success: true }],
    });
    const firebase = {
      messaging: () => ({ sendEachForMulticast }),
    } as unknown as FirebaseService;
    const svc = new PushService(prisma as never, firebase);
    await svc.sendToUser('u1', {
      title: 't', body: 'b',
      data: { templateCode: 'maintenance_created', entityType: 'maintenance', entityId: 'mid-1' },
    });
    const call = sendEachForMulticast.mock.calls[0]![0] as {
      data: Record<string, string>;
    };
    expect(call.data).toMatchObject({
      templateCode: 'maintenance_created',
      entityType: 'maintenance',
      entityId: 'mid-1',
    });
  });

  // ── Dead-token error codes ──────────────────────────────────────────────────

  it.each([
    ['messaging/registration-token-not-registered'],
    ['messaging/invalid-registration-token'],
    ['messaging/invalid-argument'],
  ])('prunes token with error code %s', async (code) => {
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'stale' }]);
    prisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });
    const sendEachForMulticast = jest.fn().mockResolvedValue({
      successCount: 0, failureCount: 1,
      responses: [{ success: false, error: { code } }],
    });
    const firebase = {
      messaging: () => ({ sendEachForMulticast }),
    } as unknown as FirebaseService;
    const svc = new PushService(prisma as never, firebase);
    const result = await svc.sendToUser('u1', { title: 't', body: 'b' });
    expect(result.pruned).toBe(1);
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['stale'] } },
    });
  });

  it('does NOT prune tokens with non-fatal error codes', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'tok' }]);
    const sendEachForMulticast = jest.fn().mockResolvedValue({
      successCount: 0, failureCount: 1,
      responses: [{ success: false, error: { code: 'messaging/quota-exceeded' } }],
    });
    const firebase = {
      messaging: () => ({ sendEachForMulticast }),
    } as unknown as FirebaseService;
    const svc = new PushService(prisma as never, firebase);
    const result = await svc.sendToUser('u1', { title: 't', body: 'b' });
    expect(result.pruned).toBe(0);
    expect(prisma.deviceToken.deleteMany).not.toHaveBeenCalled();
  });
});
