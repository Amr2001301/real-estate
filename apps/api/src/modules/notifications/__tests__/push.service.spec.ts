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
});
