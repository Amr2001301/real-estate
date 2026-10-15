import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import { MAX_DELIVERY_RETRIES, NotificationsService, retryDueAt } from '../notifications.module';
import { NotificationRetryCron } from '../notification-retry.cron';
import type { PushService } from '../push.service';
import type { EmailService } from '../../auth/email.service';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import { getTenantContext, runTenantContext } from '../../../common/tenant/tenant-context';

/**
 * FG-09 — a push or e-mail that failed is re-sent a few times instead of
 * being lost: only the channel that failed, never one that is simply not
 * configured, with growing gaps, and the row records each attempt.
 */
const TENANT = { companyId: 'co-1', bypass: false as const, isPublic: false as const };
const NOW = new Date('2026-10-15T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

type Row = {
  id: string;
  userId: string;
  templateCode: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  lastRetryAt: Date | null;
  deliveryRetries: number;
  pushError: string | null;
  emailError: string | null;
};

function row(over: Partial<Row>): Row {
  return {
    id: 'n-1',
    userId: 'u-1',
    templateCode: 'deposit_recorded',
    payload: {},
    createdAt: minutesAgo(10),
    lastRetryAt: null,
    deliveryRetries: 0,
    pushError: null,
    emailError: null,
    ...over,
  };
}

function setup(rows: Row[], opts: { pushSent?: number; emailOk?: boolean } = {}) {
  const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  const prisma = {
    notificationTemplate: {
      findMany: jest.fn().mockResolvedValue([
        {
          code: 'deposit_recorded',
          channel: NotificationChannel.PUSH,
          emailEnabled: true,
          active: true,
          subject: { ar: 'موضوع', en: 'Subject' },
          body: { ar: 'نص', en: 'Body' },
          companyId: null,
        },
      ]),
      create: jest.fn().mockResolvedValue({}),
    },
    notification: {
      findMany: jest.fn().mockResolvedValue(rows),
      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push(args);
        return {};
      }),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'u-1', locale: 'ar', email: 'u@example.com' }),
    },
    company: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const push = {
    sendToUser: jest.fn().mockResolvedValue({
      enabled: true,
      sent: opts.pushSent ?? 1,
      failed: 0,
      pruned: 0,
    }),
  };
  const sentAt = new Date();
  const email = {
    sendNotificationEmail: jest
      .fn()
      .mockResolvedValue(
        opts.emailOk === false ? { ok: false, error: 'Connection refused' } : { ok: true, sentAt },
      ),
  };
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const svc = new NotificationsService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
    email as unknown as EmailService,
  );
  return { svc, prisma, push, email, updates, sentAt };
}

describe('FG-09 — notification delivery retry', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gaps grow: 5, 15, then 45 minutes after the previous attempt', () => {
    const t = minutesAgo(0);
    expect(retryDueAt(t, 0).getTime() - t.getTime()).toBe(5 * 60_000);
    expect(retryDueAt(t, 1).getTime() - t.getTime()).toBe(15 * 60_000);
    expect(retryDueAt(t, 2).getTime() - t.getTime()).toBe(45 * 60_000);
  });

  it('asks only for recent rows with a real failure and retries left', async () => {
    const { svc, prisma } = setup([]);
    await runTenantContext(TENANT, () => svc.retryFailedDeliveries(NOW));

    const { where } = prisma.notification.findMany.mock.calls[0]![0];
    expect(where.createdAt.gte).toEqual(new Date(NOW.getTime() - 24 * 60 * 60 * 1000));
    expect(where.deliveryRetries).toEqual({ lt: MAX_DELIVERY_RETRIES });
    expect(where.OR).toEqual([
      { pushError: { not: null }, NOT: { pushError: 'FCM not configured' } },
      { emailError: { not: null }, NOT: { emailError: 'SMTP not configured' } },
    ]);
  });

  it('re-sends only the e-mail that failed, clears its error and counts the attempt', async () => {
    const { svc, push, email, updates, sentAt } = setup([
      row({ emailError: 'Connection refused' }),
    ]);

    const retried = await runTenantContext(TENANT, () => svc.retryFailedDeliveries(NOW));

    expect(retried).toBe(1);
    expect(email.sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
    expect(updates[0]!.where).toEqual({ id: 'n-1' });
    expect(updates[0]!.data).toMatchObject({
      emailSentAt: sentAt,
      emailError: null,
      deliveryRetries: { increment: 1 },
    });
    expect(updates[0]!.data.lastRetryAt).toBeInstanceOf(Date);
  });

  it('re-sends only the push that failed', async () => {
    const { svc, push, email, updates } = setup([row({ pushError: 'FCM quota exceeded' })]);

    await runTenantContext(TENANT, () => svc.retryFailedDeliveries(NOW));

    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(email.sendNotificationEmail).not.toHaveBeenCalled();
    expect(updates[0]!.data).toMatchObject({ pushError: null, deliveryRetries: { increment: 1 } });
  });

  it('a setup failure re-sends both channels', async () => {
    const { svc, push, email } = setup([row({ pushError: 'Delivery error: db timeout' })]);

    await runTenantContext(TENANT, () => svc.retryFailedDeliveries(NOW));

    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(email.sendNotificationEmail).toHaveBeenCalledTimes(1);
  });

  it('a row whose next attempt is not due yet is left alone', async () => {
    // One retry done 10 minutes ago — the next is due 15 minutes after it.
    const { svc, email, updates } = setup([
      row({ emailError: 'Connection refused', deliveryRetries: 1, lastRetryAt: minutesAgo(10) }),
    ]);

    const retried = await runTenantContext(TENANT, () => svc.retryFailedDeliveries(NOW));

    expect(retried).toBe(0);
    expect(email.sendNotificationEmail).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('a retry that fails again keeps the error and still counts the attempt', async () => {
    const { svc, updates } = setup([row({ emailError: 'Connection refused' })], { emailOk: false });

    await runTenantContext(TENANT, () => svc.retryFailedDeliveries(NOW));

    expect(updates[0]!.data).toMatchObject({
      emailError: 'Connection refused',
      deliveryRetries: { increment: 1 },
    });
    expect(updates[0]!.data.emailSentAt).toBeUndefined();
  });

  describe('NotificationRetryCron', () => {
    const config = (env: Record<string, string>) =>
      ({ get: (k: string) => env[k] }) as unknown as ConfigService;

    it('is off outside production unless enabled', async () => {
      const prisma = { notification: { groupBy: jest.fn() } };
      const notifications = { retryFailedDeliveries: jest.fn() };
      const cron = new NotificationRetryCron(
        prisma as unknown as PrismaService,
        notifications as unknown as NotificationsService,
        config({ NODE_ENV: 'test' }),
      );
      await cron.tick();
      expect(prisma.notification.groupBy).not.toHaveBeenCalled();
    });

    it('retries company by company, each inside its own tenant context', async () => {
      const seen: Array<string | null | undefined> = [];
      const prisma = {
        notification: {
          groupBy: jest.fn().mockResolvedValue([{ companyId: 'co-a' }, { companyId: 'co-b' }]),
        },
      };
      const notifications = {
        retryFailedDeliveries: jest.fn(async () => {
          seen.push(getTenantContext()?.companyId);
          return 2;
        }),
      };
      const cron = new NotificationRetryCron(
        prisma as unknown as PrismaService,
        notifications as unknown as NotificationsService,
        config({ NOTIFICATION_RETRY_ENABLED: 'true' }),
      );

      const total = await cron.retryAll(NOW);

      expect(total).toBe(4);
      expect(seen).toEqual(['co-a', 'co-b']);
    });
  });
});
