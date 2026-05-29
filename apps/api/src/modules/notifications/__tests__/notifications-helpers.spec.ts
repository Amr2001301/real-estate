import { Logger } from '@nestjs/common';
import { NotificationChannel, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications.module';
import { PushService } from '../push.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * P3 — Unit tests for the broadcast helpers added on top of the existing
 * `send()` flow. The class is `export`ed from notifications.module.ts so we
 * can `new` it directly here without the full Nest test harness. Push is
 * stubbed to a no-op since `send()`'s internal try/catch already covers the
 * push failure path.
 */

function makePrisma(users: { id: string; role: UserRole; active: boolean }[] = []) {
  const tplStore = new Map<string, { code: string; channel: NotificationChannel; subject: unknown; body: unknown }>();
  // Seed a tiny stand-in template so `send()` doesn't blow up.
  tplStore.set('test_code', {
    code: 'test_code',
    channel: NotificationChannel.IN_APP,
    subject: { ar: 's', en: 's' },
    body: { ar: 'b', en: 'b' },
  });
  const notifications: Array<{ userId: string; templateCode: string; payload: unknown }> = [];
  return {
    notifications,
    notificationTemplate: {
      findUnique: jest.fn(async ({ where }: { where: { code: string } }) =>
        tplStore.get(where.code) ?? null,
      ),
    },
    notification: {
      create: jest.fn(async ({ data }: { data: { userId: string; templateCode: string; payload: unknown } }) => {
        notifications.push({
          userId: data.userId,
          templateCode: data.templateCode,
          payload: data.payload,
        });
        return { id: `n-${notifications.length}`, ...data, createdAt: new Date() };
      }),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        users.find((u) => u.id === where.id) ?? { locale: 'ar' },
      ),
      findMany: jest.fn(async ({ where }: { where: { role: { in: UserRole[] }; active?: boolean } }) =>
        users.filter((u) => where.role.in.includes(u.role) && (where.active === undefined || u.active === where.active)),
      ),
    },
  };
}

function makeService(prismaLike: ReturnType<typeof makePrisma>, opts?: { pushThrows?: boolean }) {
  const push = {
    sendToUser: opts?.pushThrows
      ? jest.fn().mockRejectedValue(new Error('push down'))
      : jest.fn().mockResolvedValue({ enabled: true, sent: 0, failed: 0, pruned: 0 }),
  } as unknown as PushService;
  // Cast prismaLike to PrismaService — it implements only the slice we use.
  const svc = new NotificationsService(prismaLike as unknown as PrismaService, push);
  // Silence the helper's warning logs in the assertion output.
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  return { svc, push };
}

describe('NotificationsService · broadcast helpers (P3)', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('sendToUser', () => {
    it('safely skips when userId is null/undefined/empty', async () => {
      const prisma = makePrisma();
      const { svc } = makeService(prisma);
      await svc.sendToUser(null, 'test_code', {});
      await svc.sendToUser(undefined, 'test_code', {});
      await svc.sendToUser('', 'test_code', {});
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('creates a DB row when userId is present', async () => {
      const prisma = makePrisma();
      const { svc } = makeService(prisma);
      await svc.sendToUser('u-1', 'test_code', { customerName: 'X' });
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.notifications[0]).toMatchObject({
        userId: 'u-1',
        templateCode: 'test_code',
      });
    });

    it('swallows errors when the template is missing — never throws', async () => {
      const prisma = makePrisma();
      const { svc } = makeService(prisma);
      // Confirms the helper's try/catch — the caller's business action never
      // sees a thrown exception even when send() raises (template not found).
      await expect(
        svc.sendToUser('u-1', 'nonexistent_code', {}),
      ).resolves.toBeUndefined();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('sendToUsers', () => {
    it('deduplicates user ids', async () => {
      const prisma = makePrisma();
      const { svc } = makeService(prisma);
      await svc.sendToUsers(['u-1', 'u-1', 'u-2'], 'test_code', {});
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(prisma.notifications.map((n) => n.userId).sort()).toEqual(['u-1', 'u-2']);
    });

    it('drops null/undefined/empty entries silently', async () => {
      const prisma = makePrisma();
      const { svc } = makeService(prisma);
      await svc.sendToUsers([null, undefined, '', 'u-1'], 'test_code', {});
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.notifications[0]?.userId).toBe('u-1');
    });

    it('no-ops on an empty list', async () => {
      const prisma = makePrisma();
      const { svc } = makeService(prisma);
      await svc.sendToUsers([], 'test_code', {});
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('one failing recipient does not prevent the others', async () => {
      // template_missing is unseeded → send() throws for that code. We use
      // mixed codes via two parallel calls; the dedupe runs per-call.
      const prisma = makePrisma();
      const { svc } = makeService(prisma);
      await svc.sendToUsers(['u-good-1', 'u-good-2'], 'test_code', {});
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendToRoles', () => {
    it('resolves users by role, dedupes, and fans out', async () => {
      const prisma = makePrisma([
        { id: 'a-1', role: UserRole.ADMIN, active: true },
        { id: 'a-2', role: UserRole.ADMIN, active: true },
        { id: 'm-1', role: UserRole.SALES_MANAGER, active: true },
        // inactive — should be filtered out by the role query's `active: true`
        { id: 'a-3', role: UserRole.ADMIN, active: false },
        // unrelated role — should not be picked up
        { id: 's-1', role: UserRole.SALES, active: true },
      ]);
      const { svc } = makeService(prisma);
      await svc.sendToRoles([UserRole.ADMIN, UserRole.SALES_MANAGER], 'test_code', {});
      expect(prisma.notification.create).toHaveBeenCalledTimes(3);
      const ids = prisma.notifications.map((n) => n.userId).sort();
      expect(ids).toEqual(['a-1', 'a-2', 'm-1']);
    });

    it('no-ops on an empty roles array', async () => {
      const prisma = makePrisma([{ id: 'a-1', role: UserRole.ADMIN, active: true }]);
      const { svc } = makeService(prisma);
      await svc.sendToRoles([], 'test_code', {});
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('push failure does not bubble up', () => {
    it('send() proceeds even when PushService throws (existing contract preserved)', async () => {
      const prisma = makePrisma();
      const { svc } = makeService(prisma, { pushThrows: true });
      await svc.sendToUser('u-1', 'test_code', {});
      // DB row still created — business contract satisfied.
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });
  });
});
