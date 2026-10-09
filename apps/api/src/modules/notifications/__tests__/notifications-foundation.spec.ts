import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { NotificationsService } from '../notifications.module';
import { NOTIFICATION_CATALOG } from '../notification-catalog';
import type { PushService } from '../push.service';
import type { EmailService } from '../../auth/email.service';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import { runTenantContext } from '../../../common/tenant/tenant-context';

/**
 * The notification foundation: every event has its template (catalog +
 * boot insert + a drift guard over the code), the actor is never notified
 * of their own action, a company can switch an event off, broker events
 * reach the deal's agent and the firm's managers, and e-mails escape
 * user-supplied text.
 */
const TENANT = { companyId: 'co-1', bypass: false as const, isPublic: false as const };

function setup(tpl: Partial<{ active: boolean; emailEnabled: boolean; body: unknown }> = {}) {
  const template = {
    code: 'evt',
    channel: NotificationChannel.IN_APP,
    subject: { ar: 'عنوان', en: 'Title' },
    body: tpl.body ?? { ar: 'نص', en: 'Body' },
    active: tpl.active ?? true,
    emailEnabled: tpl.emailEnabled ?? false,
    companyId: null,
  };
  const prisma = {
    notificationTemplate: {
      findMany: jest.fn().mockResolvedValue([template]),
      create: jest.fn().mockResolvedValue({}),
    },
    notification: {
      create: jest.fn(async ({ data }: { data: { userId: string } }) => ({
        id: `n-${data.userId}`,
        ...data,
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ locale: 'ar', email: 'u@x.test' }),
      findMany: jest.fn(),
    },
    company: { findUnique: jest.fn().mockResolvedValue({ currency: 'EGP' }) },
    brokerUser: { findMany: jest.fn().mockResolvedValue([{ userId: 'b-1' }]) },
  };
  const push = {
    sendToUser: jest.fn().mockResolvedValue({ enabled: true, sent: 1 }),
  } as unknown as PushService;
  const email = {
    sendNotificationEmail: jest.fn().mockResolvedValue({ ok: true, sentAt: new Date() }),
  } as unknown as EmailService;
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  const svc = new NotificationsService(prisma as unknown as PrismaService, push, email);
  return { svc, prisma, email };
}

describe('notification catalog', () => {
  it('has one well-formed entry per code', () => {
    const codes = NOTIFICATION_CATALOG.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const t of NOTIFICATION_CATALOG) {
      expect(
        t.ar_subject && t.en_subject && t.ar_body !== undefined && t.en_body !== undefined,
      ).toBeTruthy();
    }
  });

  it('covers every template code the services send (no silent drops)', () => {
    const catalog = new Set(NOTIFICATION_CATALOG.map((t) => t.code));
    const src = join(__dirname, '../../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name !== '__tests__' && name !== 'node_modules') walk(p);
        } else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) files.push(p);
      }
    };
    walk(src);
    const used = new Set<string>();
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      // The code is the first snake_case literal in a send call.
      for (const m of text.matchAll(/\.(?:sendToUsers?|sendToRoles)\(([\s\S]{0,400}?)\)/g)) {
        const code = /'([a-z]+(?:_[a-z]+)+)'/.exec(m[1]!)?.[1];
        if (code) used.add(code);
      }
    }
    expect(used.size).toBeGreaterThan(20);
    expect([...used].filter((c) => !catalog.has(c))).toEqual([]);
  });
});

describe('NotificationsService foundation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('inserts only the catalog templates that are missing at boot', async () => {
    const { svc, prisma } = setup();
    prisma.notificationTemplate.findMany.mockResolvedValueOnce(
      NOTIFICATION_CATALOG.slice(1).map((t) => ({ code: t.code })),
    );
    await svc.onModuleInit();
    expect(prisma.notificationTemplate.create).toHaveBeenCalledTimes(1);
    expect(prisma.notificationTemplate.create.mock.calls[0][0].data.code).toBe(
      NOTIFICATION_CATALOG[0]!.code,
    );
  });

  it('never notifies the user whose action caused the event', async () => {
    const { svc, prisma } = setup();
    await runTenantContext(TENANT, () =>
      svc.sendToUsers(['actor', 'other'], 'evt', {}, { except: 'actor' }),
    );
    expect(prisma.notification.create.mock.calls.map((c) => c[0].data.userId)).toEqual(['other']);
  });

  it('skips automatic sends of an event the company switched off — a manual send still goes', async () => {
    const { svc, prisma } = setup({ active: false });
    await runTenantContext(TENANT, () => svc.sendToUser('u-1', 'evt'));
    expect(prisma.notification.create).not.toHaveBeenCalled();
    await runTenantContext(TENANT, () => svc.send({ userId: 'u-1', templateCode: 'evt' }));
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('escapes user-supplied text in e-mails', async () => {
    const { svc, email } = setup({
      emailEnabled: true,
      body: { ar: 'العميل {{name}}', en: '{{name}}' },
    });
    await runTenantContext(TENANT, () =>
      svc.sendToUser('u-1', 'evt', { name: '<img src=x onerror=alert(1)>' }),
    );
    const html = (email.sendNotificationEmail as jest.Mock).mock.calls[0][2] as string;
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&#60;img');
  });

  describe('brokerRecipients', () => {
    const where = (prisma: ReturnType<typeof setup>['prisma']) =>
      prisma.brokerUser.findMany.mock.calls[0][0].where;

    it('the deal agent plus the firm managers', async () => {
      const { svc, prisma } = setup();
      await svc.brokerRecipients('broker-1', { agentUserId: 'agent-1' });
      expect(where(prisma)).toEqual({
        brokerId: 'broker-1',
        status: 'ACTIVE',
        OR: [{ isPrimaryContact: true }, { canManageBrokerUsers: true }, { userId: 'agent-1' }],
      });
    });

    it('money events keep only users who may see commissions', async () => {
      const { svc, prisma } = setup();
      await svc.brokerRecipients('broker-1', { money: true });
      expect(where(prisma)).toMatchObject({ canViewCommissions: true });
      expect(where(prisma).OR).toEqual([
        { isPrimaryContact: true },
        { canManageBrokerUsers: true },
      ]);
    });

    it('firm-wide events reach every active user; no broker → nobody', async () => {
      const { svc, prisma } = setup();
      await svc.brokerRecipients('broker-1', { everyone: true });
      expect(where(prisma)).toEqual({ brokerId: 'broker-1', status: 'ACTIVE' });
      await expect(svc.brokerRecipients(null)).resolves.toEqual([]);
    });
  });
});
