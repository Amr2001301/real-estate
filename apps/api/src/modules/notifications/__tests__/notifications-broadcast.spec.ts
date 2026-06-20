import { BadRequestException, Logger } from '@nestjs/common';
import { NotificationChannel, UserRole } from '@prisma/client';
import { NotificationsService, BroadcastTarget } from '../notifications.module';
import { PushService } from '../push.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * P4 — Broadcast hardening unit tests.
 *
 * Covers:
 *  - PUSH channel rejected when Firebase is disabled
 *  - Correct recipient resolution for every BroadcastTarget value
 *  - Audit payload fields (broadcastId, sentBy, broadcastAt, targetType, targetValue)
 *  - Preview (dry-run) returns count without creating DB rows
 *  - No duplicate notifications per recipient regardless of device count
 *  - Empty recipient list returns gracefully without calling notification.create
 */

type UserRow = { id: string; role: UserRole; active: boolean };

function makePrisma(users: UserRow[] = []) {
  const tplStore = new Map([
    [
      'admin_broadcast',
      {
        code: 'admin_broadcast',
        channel: NotificationChannel.IN_APP,
        subject: { ar: '{{title_ar}}', en: '{{title_en}}' },
        body: { ar: '{{body_ar}}', en: '{{body_en}}' },
      },
    ],
  ]);

  const notifications: Array<{ userId: string; templateCode: string; payload: Record<string, unknown> }> = [];

  return {
    notifications,
    notificationTemplate: {
      findUnique: jest.fn(async ({ where }: { where: { code: string } }) =>
        tplStore.get(where.code) ?? null,
      ),
    },
    notification: {
      create: jest.fn(
        async ({ data }: { data: { userId: string; templateCode: string; payload: Record<string, unknown> } }) => {
          const row = { userId: data.userId, templateCode: data.templateCode, payload: data.payload };
          notifications.push(row);
          return { id: `n-${notifications.length}`, ...data, createdAt: new Date() };
        },
      ),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        users.find((u) => u.id === where.id) ?? { locale: 'ar' },
      ),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: {
            role?: { in: UserRole[] };
            active?: boolean;
          };
        }) => {
          return users.filter((u) => {
            const roleMatch = !where.role ? true : where.role.in.includes(u.role);
            const activeMatch = where.active === undefined ? true : u.active === where.active;
            return roleMatch && activeMatch;
          });
        },
      ),
    },
  };
}

function makeService(
  prismaLike: ReturnType<typeof makePrisma>,
  opts: { pushEnabled?: boolean; pushThrows?: boolean } = {},
) {
  const push = {
    get pushEnabled() { return opts.pushEnabled ?? false; },
    sendToUser: opts.pushThrows
      ? jest.fn().mockRejectedValue(new Error('push down'))
      : jest.fn().mockResolvedValue({ enabled: false, sent: 0, failed: 0, pruned: 0 }),
  } as unknown as PushService;

  const svc = new NotificationsService(prismaLike as unknown as PrismaService, push);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  return { svc, push };
}

const BASE_DTO = {
  title_ar: 'عنوان',
  title_en: 'Title',
  body_ar: 'نص',
  body_en: 'Body',
  channel: NotificationChannel.IN_APP,
};

describe('NotificationsService · broadcastNotification (P4)', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── PUSH guard ────────────────────────────────────────────────────────────

  describe('PUSH channel safety', () => {
    it('throws BadRequestException when PUSH is selected and Firebase is disabled', async () => {
      const prisma = makePrisma();
      const { svc } = makeService(prisma, { pushEnabled: false });
      await expect(
        svc.broadcastNotification('admin-1', {
          ...BASE_DTO,
          target: BroadcastTarget.ALL_CUSTOMERS,
          channel: NotificationChannel.PUSH,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('proceeds with IN_APP when Firebase is disabled (normal path)', async () => {
      const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
      const { svc } = makeService(prisma, { pushEnabled: false });
      const result = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO,
        target: BroadcastTarget.ALL_CUSTOMERS,
        channel: NotificationChannel.IN_APP,
      });
      expect(result.sent).toBe(1);
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── Recipient resolution ──────────────────────────────────────────────────

  describe('resolveRecipients — correct fan-out per target', () => {
    const users: UserRow[] = [
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
      { id: 'b-1', role: UserRole.BROKER, active: true },
      { id: 's-1', role: UserRole.SALES, active: true },
      { id: 'm-1', role: UserRole.MAINTENANCE_SUPERVISOR, active: true },
      { id: 'a-1', role: UserRole.ADMIN, active: true },
      { id: 'c-inactive', role: UserRole.CUSTOMER, active: false },
    ];

    it('ALL_CUSTOMERS → only active CUSTOMERs receive a notification', async () => {
      const prisma = makePrisma(users);
      const { svc } = makeService(prisma);
      const r = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO, target: BroadcastTarget.ALL_CUSTOMERS,
      });
      expect(r.recipientCount).toBe(2);
      const ids = prisma.notifications.map((n) => n.userId).sort();
      expect(ids).toEqual(['c-1', 'c-2']);
    });

    it('ALL_BROKERS → only active BROKERs receive a notification', async () => {
      const prisma = makePrisma(users);
      const { svc } = makeService(prisma);
      const r = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO, target: BroadcastTarget.ALL_BROKERS,
      });
      expect(r.recipientCount).toBe(1);
      expect(prisma.notifications[0]?.userId).toBe('b-1');
    });

    it('ALL_SALES → only active SALES receive a notification', async () => {
      const prisma = makePrisma(users);
      const { svc } = makeService(prisma);
      const r = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO, target: BroadcastTarget.ALL_SALES,
      });
      expect(r.recipientCount).toBe(1);
      expect(prisma.notifications[0]?.userId).toBe('s-1');
    });

    it('ALL_MAINTENANCE_SUPERVISORS → only active MAINTENANCE_SUPERVISORs', async () => {
      const prisma = makePrisma(users);
      const { svc } = makeService(prisma);
      const r = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO, target: BroadcastTarget.ALL_MAINTENANCE_SUPERVISORS,
      });
      expect(r.recipientCount).toBe(1);
      expect(prisma.notifications[0]?.userId).toBe('m-1');
    });

    it('ALL_ACTIVE → every active user regardless of role (inactive excluded)', async () => {
      const prisma = makePrisma(users);
      const { svc } = makeService(prisma);
      const r = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO, target: BroadcastTarget.ALL_ACTIVE,
      });
      // 6 active users (c-1, c-2, b-1, s-1, m-1, a-1), c-inactive excluded
      expect(r.recipientCount).toBe(6);
      expect(prisma.notifications).toHaveLength(6);
    });

    it('ROLE + targetRole → only users with that role receive a notification', async () => {
      const prisma = makePrisma(users);
      const { svc } = makeService(prisma);
      const r = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO,
        target: BroadcastTarget.ROLE,
        targetRole: UserRole.ADMIN,
      });
      expect(r.recipientCount).toBe(1);
      expect(prisma.notifications[0]?.userId).toBe('a-1');
    });

    it('USER + targetUserId → exactly one notification to that user', async () => {
      const prisma = makePrisma(users);
      const { svc } = makeService(prisma);
      const r = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO,
        target: BroadcastTarget.USER,
        targetUserId: 'c-1',
      });
      expect(r.recipientCount).toBe(1);
      expect(prisma.notifications[0]?.userId).toBe('c-1');
    });

    it('ROLE without targetRole → throws BadRequestException', async () => {
      const prisma = makePrisma(users);
      const { svc } = makeService(prisma);
      await expect(
        svc.broadcastNotification('admin-1', {
          ...BASE_DTO,
          target: BroadcastTarget.ROLE,
          // targetRole omitted
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('USER without targetUserId → throws BadRequestException', async () => {
      const prisma = makePrisma(users);
      const { svc } = makeService(prisma);
      await expect(
        svc.broadcastNotification('admin-1', {
          ...BASE_DTO,
          target: BroadcastTarget.USER,
          // targetUserId omitted
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('inactive users are excluded from ALL_CUSTOMERS', async () => {
      const prisma = makePrisma(users);
      const { svc } = makeService(prisma);
      const r = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO, target: BroadcastTarget.ALL_CUSTOMERS,
      });
      const userIds = prisma.notifications.map((n) => n.userId);
      expect(userIds).not.toContain('c-inactive');
      expect(r.recipientCount).toBe(2);
    });
  });

  // ── Audit payload ─────────────────────────────────────────────────────────

  describe('Audit payload fields', () => {
    it('every notification payload includes broadcastId, sentBy, broadcastAt, targetType, targetValue', async () => {
      const prisma = makePrisma([
        { id: 'c-1', role: UserRole.CUSTOMER, active: true },
        { id: 'c-2', role: UserRole.CUSTOMER, active: true },
      ]);
      const { svc } = makeService(prisma);
      const result = await svc.broadcastNotification('admin-uuid-1', {
        ...BASE_DTO,
        target: BroadcastTarget.ALL_CUSTOMERS,
      });

      expect(result.broadcastId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      for (const notif of prisma.notifications) {
        const p = notif.payload as Record<string, unknown>;
        expect(p).toHaveProperty('broadcastId', result.broadcastId);
        expect(p).toHaveProperty('sentBy', 'admin-uuid-1');
        expect(p).toHaveProperty('broadcastAt');
        expect(typeof p['broadcastAt']).toBe('string');
        expect(p).toHaveProperty('targetType', BroadcastTarget.ALL_CUSTOMERS);
        expect(p).toHaveProperty('targetValue', BroadcastTarget.ALL_CUSTOMERS);
      }
    });

    it('targetValue is the targetRole when target is ROLE', async () => {
      const prisma = makePrisma([{ id: 'a-1', role: UserRole.ADMIN, active: true }]);
      const { svc } = makeService(prisma);
      await svc.broadcastNotification('admin-1', {
        ...BASE_DTO,
        target: BroadcastTarget.ROLE,
        targetRole: UserRole.ADMIN,
      });
      const p = prisma.notifications[0]!.payload as Record<string, unknown>;
      expect(p['targetValue']).toBe(UserRole.ADMIN);
    });

    it('targetValue is the targetUserId when target is USER', async () => {
      const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
      const { svc } = makeService(prisma);
      await svc.broadcastNotification('admin-1', {
        ...BASE_DTO,
        target: BroadcastTarget.USER,
        targetUserId: 'c-1',
      });
      const p = prisma.notifications[0]!.payload as Record<string, unknown>;
      expect(p['targetValue']).toBe('c-1');
    });

    it('entityType and entityId are included in payload when provided', async () => {
      const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
      const { svc } = makeService(prisma);
      await svc.broadcastNotification('admin-1', {
        ...BASE_DTO,
        target: BroadcastTarget.USER,
        targetUserId: 'c-1',
        entityType: 'maintenance',
        entityId: 'maint-uuid-1',
      });
      const p = prisma.notifications[0]!.payload as Record<string, unknown>;
      expect(p['entityType']).toBe('maintenance');
      expect(p['entityId']).toBe('maint-uuid-1');
    });

    it('payload does NOT contain phone, email, storage URLs, or bank data', async () => {
      const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
      const { svc } = makeService(prisma);
      await svc.broadcastNotification('admin-1', {
        ...BASE_DTO,
        target: BroadcastTarget.USER,
        targetUserId: 'c-1',
      });
      const p = prisma.notifications[0]!.payload as Record<string, unknown>;
      const forbidden = ['phone', 'email', 'password', 'token', 'secret', 'bank', 'iban', 'url', 'storage'];
      for (const key of forbidden) {
        expect(Object.keys(p).some((k) => k.toLowerCase().includes(key))).toBe(false);
      }
    });
  });

  // ── Delivery counts ───────────────────────────────────────────────────────

  describe('Delivery result counts', () => {
    it('recipientCount, sent, failed reflect actual outcomes', async () => {
      const prisma = makePrisma([
        { id: 'c-1', role: UserRole.CUSTOMER, active: true },
        { id: 'c-2', role: UserRole.CUSTOMER, active: true },
      ]);
      const { svc } = makeService(prisma);
      const r = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO, target: BroadcastTarget.ALL_CUSTOMERS,
      });
      expect(r.recipientCount).toBe(2);
      expect(r.sent).toBe(2);
      expect(r.failed).toBe(0);
    });

    it('returns {sent:0, failed:0} immediately when recipient list is empty', async () => {
      const prisma = makePrisma([]); // no users
      const { svc } = makeService(prisma);
      const r = await svc.broadcastNotification('admin-1', {
        ...BASE_DTO, target: BroadcastTarget.ALL_CUSTOMERS,
      });
      expect(r.recipientCount).toBe(0);
      expect(r.sent).toBe(0);
      expect(r.failed).toBe(0);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  // ── No duplicates per recipient ───────────────────────────────────────────

  describe('No duplicate notifications per recipient', () => {
    it('one DB row per user regardless of device count (device count does not affect notification row count)', async () => {
      // Device fan-out happens inside PushService — the broadcast creates
      // exactly one notification record per userId.
      const prisma = makePrisma([
        { id: 'c-1', role: UserRole.CUSTOMER, active: true },
        { id: 'c-2', role: UserRole.CUSTOMER, active: true },
      ]);
      const { svc } = makeService(prisma);
      await svc.broadcastNotification('admin-1', {
        ...BASE_DTO, target: BroadcastTarget.ALL_CUSTOMERS,
      });
      // Two recipients → exactly two DB rows, regardless of how many devices each has
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      const userIds = prisma.notifications.map((n) => n.userId);
      expect(new Set(userIds).size).toBe(userIds.length); // all unique
    });
  });
});

// ── Preview (dry-run) ─────────────────────────────────────────────────────────

describe('NotificationsService · previewBroadcast (P4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns recipientCount without creating any notification DB rows', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma, { pushEnabled: false });
    const result = await svc.previewBroadcast({ target: BroadcastTarget.ALL_CUSTOMERS });
    expect(result.recipientCount).toBe(2);
    expect(result.pushEnabled).toBe(false);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('reflects pushEnabled=true when Firebase is configured', async () => {
    const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
    const { svc } = makeService(prisma, { pushEnabled: true });
    const result = await svc.previewBroadcast({ target: BroadcastTarget.ALL_CUSTOMERS });
    expect(result.pushEnabled).toBe(true);
  });

  it('ALL_ACTIVE preview counts all active users across all roles', async () => {
    const prisma = makePrisma([
      { id: 'a-1', role: UserRole.ADMIN, active: true },
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'b-1', role: UserRole.BROKER, active: true },
      { id: 'c-inactive', role: UserRole.CUSTOMER, active: false },
    ]);
    const { svc } = makeService(prisma);
    const result = await svc.previewBroadcast({ target: BroadcastTarget.ALL_ACTIVE });
    expect(result.recipientCount).toBe(3);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
