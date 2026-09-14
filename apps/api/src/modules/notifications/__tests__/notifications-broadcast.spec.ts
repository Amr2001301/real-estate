import { BadRequestException, Logger } from '@nestjs/common';
import { NotificationChannel, UserRole } from '@prisma/client';
import { NotificationsService, BroadcastTarget, BroadcastChannel } from '../notifications.module';
import { PushService, PushResult } from '../push.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EmailService } from '../../auth/email.service';
import { runTenantContext } from '../../../common/tenant/tenant-context';

const TEST_TENANT = { companyId: 'test-co-00000000-0000-0000-0000', bypass: false as const, isPublic: false as const };

/**
 * Broadcast hardening unit tests.
 *
 * Covers:
 *  - Strict channel semantics: IN_APP ≠ PUSH, no silent fallback
 *  - PUSH guard: disabled Firebase throws BEFORE any DB write
 *  - PUSH enabled: pushSent/pushFailed/noDeviceTokens correct; NO Notification rows
 *  - IN_APP: notificationRecordsCreated correct; push never called
 *  - Recipient resolution for every BroadcastTarget
 *  - Audit payload fields (broadcastId, sentBy, broadcastAt, targetType, targetValue)
 *  - Preview (dry-run) returns count + device counts without sending
 */

type UserRow = { id: string; role: UserRole; active: boolean; locale?: string };

function makePrisma(
  users: UserRow[] = [],
  deviceTokens: Array<{ userId: string }> = [],
) {
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

  const notifications: Array<{ userId: string; templateCode: string; payload: Record<string, unknown>; channel: string }> = [];

  return {
    notifications,
    notificationTemplate: {
      findUnique: jest.fn(async ({ where }: { where: { code: string } }) =>
        tplStore.get(where.code) ?? null,
      ),
    },
    notification: {
      create: jest.fn(
        async ({ data }: { data: { userId: string; templateCode: string; payload: Record<string, unknown>; channel: string } }) => {
          const row = { userId: data.userId, templateCode: data.templateCode, payload: data.payload, channel: data.channel };
          notifications.push(row);
          return { id: `n-${notifications.length}`, ...data, createdAt: new Date() };
        },
      ),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        users.find((u) => u.id === where.id) ?? { locale: 'ar' },
      ),
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) =>
        users.find((u) => u.id === where.id) ?? null,
      ),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: {
            role?: { in: UserRole[] };
            active?: boolean;
            id?: { in: string[] };
          };
        }) => {
          return users.filter((u) => {
            const roleMatch   = !where.role ? true : where.role.in.includes(u.role);
            const activeMatch = where.active === undefined ? true : u.active === where.active;
            const idMatch     = !where.id   ? true : where.id.in.includes(u.id);
            return roleMatch && activeMatch && idMatch;
          });
        },
      ),
    },
    deviceToken: {
      findMany: jest.fn(
        async ({ where }: { where?: { userId?: { in: string[] } } }) => {
          if (!where?.userId?.in) return deviceTokens;
          return deviceTokens.filter((t) => where.userId!.in.includes(t.userId));
        },
      ),
    },
  };
}

function makeService(
  prismaLike: ReturnType<typeof makePrisma>,
  opts: {
    pushEnabled?: boolean;
    pushThrows?: boolean;
    /**
     * Per-user push result factory. When omitted:
     *   pushEnabled=false → { enabled: false, sent: 0, failed: 0, pruned: 0 }
     *   pushEnabled=true  → { enabled: true,  sent: 1, failed: 0, pruned: 0 }
     */
    pushResultFn?: (userId: string) => PushResult;
  } = {},
) {
  const enabled = opts.pushEnabled ?? false;
  const defaultResult: PushResult = { enabled, sent: enabled ? 1 : 0, failed: 0, pruned: 0 };
  const push = {
    get pushEnabled() { return enabled; },
    sendToUser: opts.pushThrows
      ? jest.fn().mockRejectedValue(new Error('push down'))
      : jest.fn().mockImplementation(async (userId: string) =>
          opts.pushResultFn ? opts.pushResultFn(userId) : defaultResult,
        ),
  } as unknown as PushService;

  const emailStub = { sendNotificationEmail: jest.fn().mockResolvedValue(undefined) } as unknown as EmailService;
  const svc = new NotificationsService(prismaLike as unknown as PrismaService, push, emailStub);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  return { svc, push };
}

const BASE_IN_APP = {
  title_ar: 'عنوان',
  title_en: 'Title',
  body_ar: 'نص',
  body_en: 'Body',
  channel: BroadcastChannel.IN_APP,
};

const BASE_PUSH = {
  ...BASE_IN_APP,
  channel: BroadcastChannel.PUSH,
};

const BASE_DUAL = {
  ...BASE_IN_APP,
  channel: BroadcastChannel.IN_APP_AND_PUSH,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH strict semantics
// ═══════════════════════════════════════════════════════════════════════════════

describe('NotificationsService · PUSH strict channel semantics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PUSH + Firebase disabled → throws BadRequestException before any DB write', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma, { pushEnabled: false });

    await expect(
      runTenantContext(TEST_TENANT, () =>
        svc.broadcastNotification('admin-1', {
          ...BASE_PUSH,
          target: BroadcastTarget.ALL_CUSTOMERS,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Critical: zero Notification rows — PUSH guard must fire before any DB writes
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('PUSH + Firebase enabled + tokens → pushSent correct, zero Notification rows', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    // Each user has 1 device → sent=1 per user
    const { svc, push } = makeService(prisma, {
      pushEnabled: true,
      pushResultFn: () => ({ enabled: true, sent: 1, failed: 0, pruned: 0 }),
    });

    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_PUSH,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

    expect(result.channel).toBe(BroadcastChannel.PUSH);
    expect(result.recipientCount).toBe(2);
    expect(result.pushSent).toBe(2);
    expect(result.pushFailed).toBe(0);
    expect(result.noDeviceTokens).toBe(0);
    // No IN_APP Notification rows must be created for a PUSH broadcast
    expect(prisma.notification.create).not.toHaveBeenCalled();
    // push.sendToUser called once per recipient
    expect(push.sendToUser).toHaveBeenCalledTimes(2);
  });

  it('PUSH + Firebase enabled + no device tokens → noDeviceTokens=N, pushSent=0, zero Notification rows', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
      { id: 'c-3', role: UserRole.CUSTOMER, active: true },
    ]);
    // PushService returns {sent:0, failed:0} when user has no tokens
    const { svc } = makeService(prisma, {
      pushEnabled: true,
      pushResultFn: () => ({ enabled: true, sent: 0, failed: 0, pruned: 0 }),
    });

    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_PUSH,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

    expect(result.pushSent).toBe(0);
    expect(result.pushFailed).toBe(0);
    expect(result.noDeviceTokens).toBe(3);
    expect(result.failureHint).toBe('no_device_tokens');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('PUSH + partial token failure → pushFailed counted, zero Notification rows', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma, {
      pushEnabled: true,
      pushResultFn: (userId) =>
        userId === 'c-1'
          ? { enabled: true, sent: 1, failed: 0, pruned: 0 }
          : { enabled: true, sent: 0, failed: 1, pruned: 0 },
    });

    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_PUSH,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

    expect(result.pushSent).toBe(1);
    expect(result.pushFailed).toBe(1);
    expect(result.noDeviceTokens).toBe(0);
    expect(result.failureHint).toBe('push_failed');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('PUSH result does not contain notificationRecordsCreated or failed fields', async () => {
    const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
    const { svc } = makeService(prisma, {
      pushEnabled: true,
      pushResultFn: () => ({ enabled: true, sent: 1, failed: 0, pruned: 0 }),
    });

    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_PUSH,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

    expect(result).not.toHaveProperty('notificationRecordsCreated');
    expect(result).not.toHaveProperty('failed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IN_APP strict semantics
// ═══════════════════════════════════════════════════════════════════════════════

describe('NotificationsService · IN_APP strict channel semantics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('IN_APP → creates Notification rows, push.sendToUser never called', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc, push } = makeService(prisma, { pushEnabled: false });

    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_IN_APP,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

    expect(result.channel).toBe(BroadcastChannel.IN_APP);
    expect(result.notificationRecordsCreated).toBe(2);
    expect(result.failed).toBe(0);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    // IN_APP broadcast must NEVER call push
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it('IN_APP Notification rows have channel=IN_APP regardless of template default', async () => {
    const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
    const { svc } = makeService(prisma);

    await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_IN_APP,
        target: BroadcastTarget.USER,
        targetUserId: 'c-1',
      }),
    );

    expect(prisma.notifications[0]?.channel).toBe(NotificationChannel.IN_APP);
  });

  it('IN_APP result does not contain pushSent, pushFailed, noDeviceTokens fields', async () => {
    const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
    const { svc } = makeService(prisma);

    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_IN_APP,
        target: BroadcastTarget.USER,
        targetUserId: 'c-1',
      }),
    );

    expect(result).not.toHaveProperty('pushSent');
    expect(result).not.toHaveProperty('pushFailed');
    expect(result).not.toHaveProperty('noDeviceTokens');
  });

  it('proceeds with IN_APP when Firebase is disabled (correct normal path)', async () => {
    const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
    const { svc } = makeService(prisma, { pushEnabled: false });
    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_IN_APP,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );
    expect(result.notificationRecordsCreated).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// No silent fallback
// ═══════════════════════════════════════════════════════════════════════════════

describe('NotificationsService · no silent PUSH→IN_APP fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('selecting PUSH with Firebase disabled never silently creates IN_APP records', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma, { pushEnabled: false });

    await expect(
      runTenantContext(TEST_TENANT, () =>
        svc.broadcastNotification('admin-1', {
          ...BASE_PUSH,
          target: BroadcastTarget.ALL_CUSTOMERS,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Zero rows in the notifications table — never silently fell back to IN_APP
    expect(prisma.notifications).toHaveLength(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Recipient resolution
// ═══════════════════════════════════════════════════════════════════════════════

describe('NotificationsService · resolveRecipients — correct fan-out per target', () => {
  beforeEach(() => jest.clearAllMocks());

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
    const r = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.ALL_CUSTOMERS }),
    );
    expect(r.recipientCount).toBe(2);
    const ids = prisma.notifications.map((n) => n.userId).sort();
    expect(ids).toEqual(['c-1', 'c-2']);
  });

  it('ALL_BROKERS → only active BROKERs', async () => {
    const prisma = makePrisma(users);
    const { svc } = makeService(prisma);
    const r = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.ALL_BROKERS }),
    );
    expect(r.recipientCount).toBe(1);
    expect(prisma.notifications[0]?.userId).toBe('b-1');
  });

  it('ALL_SALES → only active SALES', async () => {
    const prisma = makePrisma(users);
    const { svc } = makeService(prisma);
    const r = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.ALL_SALES }),
    );
    expect(r.recipientCount).toBe(1);
    expect(prisma.notifications[0]?.userId).toBe('s-1');
  });

  it('ALL_MAINTENANCE_SUPERVISORS → only active MAINTENANCE_SUPERVISORs', async () => {
    const prisma = makePrisma(users);
    const { svc } = makeService(prisma);
    const r = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.ALL_MAINTENANCE_SUPERVISORS }),
    );
    expect(r.recipientCount).toBe(1);
    expect(prisma.notifications[0]?.userId).toBe('m-1');
  });

  it('ALL_ACTIVE → every active user regardless of role (inactive excluded)', async () => {
    const prisma = makePrisma(users);
    const { svc } = makeService(prisma);
    const r = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.ALL_ACTIVE }),
    );
    expect(r.recipientCount).toBe(6); // c-inactive excluded
    expect(prisma.notifications).toHaveLength(6);
  });

  it('ROLE + targetRole → only users with that role', async () => {
    const prisma = makePrisma(users);
    const { svc } = makeService(prisma);
    const r = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_IN_APP, target: BroadcastTarget.ROLE, targetRole: UserRole.ADMIN,
      }),
    );
    expect(r.recipientCount).toBe(1);
    expect(prisma.notifications[0]?.userId).toBe('a-1');
  });

  it('USER + targetUserId → exactly one notification', async () => {
    const prisma = makePrisma(users);
    const { svc } = makeService(prisma);
    const r = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_IN_APP, target: BroadcastTarget.USER, targetUserId: 'c-1',
      }),
    );
    expect(r.recipientCount).toBe(1);
    expect(prisma.notifications[0]?.userId).toBe('c-1');
  });

  it('ROLE without targetRole → throws BadRequestException', async () => {
    const prisma = makePrisma(users);
    const { svc } = makeService(prisma);
    await expect(
      runTenantContext(TEST_TENANT, () =>
        svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.ROLE }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('USER without targetUserId → throws BadRequestException', async () => {
    const prisma = makePrisma(users);
    const { svc } = makeService(prisma);
    await expect(
      runTenantContext(TEST_TENANT, () =>
        svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.USER }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('inactive users are excluded from ALL_CUSTOMERS', async () => {
    const prisma = makePrisma(users);
    const { svc } = makeService(prisma);
    const r = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.ALL_CUSTOMERS }),
    );
    expect(prisma.notifications.map((n) => n.userId)).not.toContain('c-inactive');
    expect(r.recipientCount).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Audit payload
// ═══════════════════════════════════════════════════════════════════════════════

describe('NotificationsService · audit payload fields', () => {
  beforeEach(() => jest.clearAllMocks());

  it('every IN_APP notification payload has broadcastId, sentBy, broadcastAt, targetType, targetValue', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma);
    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-uuid-1', {
        ...BASE_IN_APP,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

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

  it('targetValue is targetRole when target=ROLE', async () => {
    const prisma = makePrisma([{ id: 'a-1', role: UserRole.ADMIN, active: true }]);
    const { svc } = makeService(prisma);
    await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_IN_APP, target: BroadcastTarget.ROLE, targetRole: UserRole.ADMIN,
      }),
    );
    expect((prisma.notifications[0]!.payload as Record<string, unknown>)['targetValue']).toBe(UserRole.ADMIN);
  });

  it('targetValue is targetUserId when target=USER', async () => {
    const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
    const { svc } = makeService(prisma);
    await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_IN_APP, target: BroadcastTarget.USER, targetUserId: 'c-1',
      }),
    );
    expect((prisma.notifications[0]!.payload as Record<string, unknown>)['targetValue']).toBe('c-1');
  });

  it('entityType and entityId are included in payload when provided', async () => {
    const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
    const { svc } = makeService(prisma);
    await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_IN_APP,
        target: BroadcastTarget.USER,
        targetUserId: 'c-1',
        entityType: 'maintenance',
        entityId: 'maint-uuid-1',
      }),
    );
    const p = prisma.notifications[0]!.payload as Record<string, unknown>;
    expect(p['entityType']).toBe('maintenance');
    expect(p['entityId']).toBe('maint-uuid-1');
  });

  it('payload has no sensitive keys (phone, email, password, token, bank, etc.)', async () => {
    const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
    const { svc } = makeService(prisma);
    await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_IN_APP, target: BroadcastTarget.USER, targetUserId: 'c-1',
      }),
    );
    const p = prisma.notifications[0]!.payload as Record<string, unknown>;
    const forbidden = ['phone', 'email', 'password', 'token', 'secret', 'bank', 'iban', 'url', 'storage'];
    for (const key of forbidden) {
      expect(Object.keys(p).some((k) => k.toLowerCase().includes(key))).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IN_APP delivery counts
// ═══════════════════════════════════════════════════════════════════════════════

describe('NotificationsService · IN_APP delivery counts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('notificationRecordsCreated and failed reflect actual outcomes', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma);
    const r = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.ALL_CUSTOMERS }),
    );
    expect(r.recipientCount).toBe(2);
    expect(r.notificationRecordsCreated).toBe(2);
    expect(r.failed).toBe(0);
  });

  it('returns empty result immediately when recipient list is empty', async () => {
    const prisma = makePrisma([]);
    const { svc } = makeService(prisma);
    const r = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.ALL_CUSTOMERS }),
    );
    expect(r.recipientCount).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('one DB row per user — device count has no effect on row count', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma);
    await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', { ...BASE_IN_APP, target: BroadcastTarget.ALL_CUSTOMERS }),
    );
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    const userIds = prisma.notifications.map((n) => n.userId);
    expect(new Set(userIds).size).toBe(userIds.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Preview (dry-run)
// ═══════════════════════════════════════════════════════════════════════════════

describe('NotificationsService · previewBroadcast', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns recipientCount without creating any notification rows', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma, { pushEnabled: false });
    const result = await runTenantContext(TEST_TENANT, () =>
      svc.previewBroadcast({ target: BroadcastTarget.ALL_CUSTOMERS }),
    );
    expect(result.recipientCount).toBe(2);
    expect(result.pushEnabled).toBe(false);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('reflects pushEnabled=true when Firebase is configured', async () => {
    const prisma = makePrisma([{ id: 'c-1', role: UserRole.CUSTOMER, active: true }]);
    const { svc } = makeService(prisma, { pushEnabled: true });
    const result = await runTenantContext(TEST_TENANT, () =>
      svc.previewBroadcast({ target: BroadcastTarget.ALL_CUSTOMERS }),
    );
    expect(result.pushEnabled).toBe(true);
  });

  it('ALL_ACTIVE preview counts all active users', async () => {
    const prisma = makePrisma([
      { id: 'a-1', role: UserRole.ADMIN, active: true },
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'b-1', role: UserRole.BROKER, active: true },
      { id: 'c-inactive', role: UserRole.CUSTOMER, active: false },
    ]);
    const { svc } = makeService(prisma);
    const result = await runTenantContext(TEST_TENANT, () =>
      svc.previewBroadcast({ target: BroadcastTarget.ALL_ACTIVE }),
    );
    expect(result.recipientCount).toBe(3);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('PUSH preview with channel=PUSH returns estimatedDeviceCount and usersWithoutDevices', async () => {
    const tokens = [
      { userId: 'c-1' }, // 2 tokens for c-1
      { userId: 'c-1' },
      { userId: 'c-2' }, // 1 token for c-2
      // c-3 has no tokens
    ];
    const prisma = makePrisma(
      [
        { id: 'c-1', role: UserRole.CUSTOMER, active: true },
        { id: 'c-2', role: UserRole.CUSTOMER, active: true },
        { id: 'c-3', role: UserRole.CUSTOMER, active: true },
      ],
      tokens,
    );
    const { svc } = makeService(prisma, { pushEnabled: true });
    const result = await runTenantContext(TEST_TENANT, () =>
      svc.previewBroadcast({
        target: BroadcastTarget.ALL_CUSTOMERS,
        channel: BroadcastChannel.PUSH,
      }),
    );
    expect(result.recipientCount).toBe(3);
    expect(result.estimatedDeviceCount).toBe(3); // 2+1
    expect(result.usersWithoutDevices).toBe(1);  // c-3
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('PUSH preview without channel does not query device tokens', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma);
    const result = await runTenantContext(TEST_TENANT, () =>
      svc.previewBroadcast({ target: BroadcastTarget.ALL_CUSTOMERS }),
    );
    expect(result.estimatedDeviceCount).toBeUndefined();
    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
  });

  it('IN_APP_AND_PUSH preview returns estimatedDeviceCount and usersWithoutDevices', async () => {
    const tokens = [{ userId: 'c-1' }, { userId: 'c-1' }]; // 2 tokens for c-1; c-2 has none
    const prisma = makePrisma(
      [
        { id: 'c-1', role: UserRole.CUSTOMER, active: true },
        { id: 'c-2', role: UserRole.CUSTOMER, active: true },
      ],
      tokens,
    );
    const { svc } = makeService(prisma, { pushEnabled: true });
    const result = await runTenantContext(TEST_TENANT, () =>
      svc.previewBroadcast({
        target: BroadcastTarget.ALL_CUSTOMERS,
        channel: BroadcastChannel.IN_APP_AND_PUSH,
      }),
    );
    expect(result.recipientCount).toBe(2);
    expect(result.estimatedDeviceCount).toBe(2); // 2 tokens for c-1
    expect(result.usersWithoutDevices).toBe(1);  // c-2 has none
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IN_APP_AND_PUSH semantics
// ═══════════════════════════════════════════════════════════════════════════════

describe('NotificationsService · IN_APP_AND_PUSH channel semantics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('IN_APP_AND_PUSH + Firebase disabled → throws BadRequestException, zero DB rows', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma, { pushEnabled: false });

    await expect(
      runTenantContext(TEST_TENANT, () =>
        svc.broadcastNotification('admin-1', {
          ...BASE_DUAL,
          target: BroadcastTarget.ALL_CUSTOMERS,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('IN_APP_AND_PUSH creates one DB row per user and sends FCM', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc, push } = makeService(prisma, {
      pushEnabled: true,
      pushResultFn: () => ({ enabled: true, sent: 1, failed: 0, pruned: 0 }),
    });

    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_DUAL,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

    expect(result.channel).toBe(BroadcastChannel.IN_APP_AND_PUSH);
    expect(result.recipientCount).toBe(2);
    // One DB row per user regardless of device count
    expect(result.notificationRecordsCreated).toBe(2);
    expect(result.failed).toBe(0);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    // FCM sent to each user
    expect(push.sendToUser).toHaveBeenCalledTimes(2);
    expect(result.pushSent).toBe(2);
    expect(result.pushFailed).toBe(0);
    expect(result.noDeviceTokens).toBe(0);
  });

  it('IN_APP_AND_PUSH creates exactly one DB row per user, not per device', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma, {
      pushEnabled: true,
      // Simulate user with 3 devices: sent=3
      pushResultFn: () => ({ enabled: true, sent: 3, failed: 0, pruned: 0 }),
    });

    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_DUAL,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

    // One DB row regardless of device count
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(result.notificationRecordsCreated).toBe(1);
    // Push sent to 3 devices (summed from PushResult)
    expect(result.pushSent).toBe(3);
  });

  it('IN_APP_AND_PUSH FCM data includes notificationId from DB row', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc, push } = makeService(prisma, {
      pushEnabled: true,
      pushResultFn: () => ({ enabled: true, sent: 1, failed: 0, pruned: 0 }),
    });

    await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_DUAL,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

    // The FCM call must include a notificationId in data (from the newly-created row)
    const call = (push.sendToUser as jest.Mock).mock.calls[0];
    const payload = call[1] as { data?: Record<string, string> };
    expect(payload.data).toHaveProperty('notificationId');
    expect(typeof payload.data?.['notificationId']).toBe('string');
    expect(payload.data?.['notificationId']).not.toBe('');
  });

  it('IN_APP_AND_PUSH noDeviceTokens reported when users have no devices', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
      { id: 'c-2', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma, {
      pushEnabled: true,
      pushResultFn: () => ({ enabled: true, sent: 0, failed: 0, pruned: 0 }),
    });

    const result = await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_DUAL,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

    // DB rows still created even when devices are absent
    expect(result.notificationRecordsCreated).toBe(2);
    expect(result.noDeviceTokens).toBe(2);
    expect(result.pushSent).toBe(0);
    expect(result.failureHint).toBe('no_device_tokens');
  });

  it('IN_APP_AND_PUSH DB rows have channel=IN_APP (not IN_APP_AND_PUSH)', async () => {
    const prisma = makePrisma([
      { id: 'c-1', role: UserRole.CUSTOMER, active: true },
    ]);
    const { svc } = makeService(prisma, {
      pushEnabled: true,
      pushResultFn: () => ({ enabled: true, sent: 1, failed: 0, pruned: 0 }),
    });

    await runTenantContext(TEST_TENANT, () =>
      svc.broadcastNotification('admin-1', {
        ...BASE_DUAL,
        target: BroadcastTarget.ALL_CUSTOMERS,
      }),
    );

    // Stored in DB as IN_APP so they appear in the mobile notification list
    expect(prisma.notifications[0]?.channel).toBe(NotificationChannel.IN_APP);
  });
});
