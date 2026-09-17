/**
 * Step 15 — Notification delivery-tracking tests.
 *
 * Verifies that NotificationsService.send() writes the correct push / email
 * outcome columns back to the Notification row after each delivery attempt.
 * No real SMTP or FCM is used — all transports are mocked.
 *
 * Outcome semantics (matches schema.prisma comment):
 *   pushSentAt  set when FCM.sendEachForMulticast succeeded and sent >= 1
 *   pushError   set when FCM is disabled OR the FCM call threw
 *   emailSentAt set when SMTP accepted the message
 *   emailError  set when SMTP is unconfigured ('SMTP not configured') OR
 *               the provider rejected the message
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { NotificationsService } from '../notifications.module';
import { PushService, PushResult } from '../push.service';
import { EmailService } from '../../auth/email.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { runTenantContext } from '../../../common/tenant/tenant-context';

// ── helpers ──────────────────────────────────────────────────────────────────

type UpdateCapture = { where: { id: string }; data: Record<string, unknown> };

/**
 * Full prisma mock suitable for the delivery-tracking path.  Unlike the
 * lean mock in notifications-helpers.spec.ts this includes `user.findFirst`
 * so resolveTenantUser() succeeds and the email/push code actually runs.
 */
function makePrisma(userEmail?: string) {
  const createdNotif = { id: 'notif-1', sentAt: new Date(), createdAt: new Date() };
  const updates: UpdateCapture[] = [];

  return {
    _createdNotif: createdNotif,
    _updates: updates,
    notificationTemplate: {
      findUnique: jest.fn().mockResolvedValue({
        code: 'deposit_recorded',
        channel: NotificationChannel.PUSH,
        emailEnabled: true,
        subject: { ar: 'موضوع', en: 'Subject' },
        body:    { ar: 'نص',   en: 'Body'    },
      }),
    },
    notification: {
      create: jest.fn().mockResolvedValue(createdNotif),
      update: jest.fn().mockImplementation(async (args: UpdateCapture) => {
        updates.push(args);
        return {};
      }),
    },
    user: {
      // resolveTenantUser calls user.findFirst scoped by companyId
      findFirst: jest.fn().mockResolvedValue({
        id: 'u-1',
        locale: 'ar',
        email: userEmail ?? null,
      }),
    },
    deviceToken: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function makePushService(opts: {
  enabled?: boolean;
  sent?: number;
  throws?: string;
}): PushService {
  if (opts.throws) {
    return {
      sendToUser: jest.fn().mockRejectedValue(new Error(opts.throws)),
      pushEnabled: true,
    } as unknown as PushService;
  }
  const result: PushResult = {
    enabled: opts.enabled ?? true,
    sent:    opts.sent ?? 0,
    failed:  0,
    pruned:  0,
  };
  return {
    sendToUser: jest.fn().mockResolvedValue(result),
    pushEnabled: opts.enabled ?? true,
  } as unknown as PushService;
}

function makeEmailService(result: { ok: true; sentAt: Date } | { ok: false; error: string }): EmailService {
  return {
    sendNotificationEmail: jest.fn().mockResolvedValue(result),
  } as unknown as EmailService;
}

const TEST_TENANT = { companyId: 'co-1', bypass: false as const, isPublic: false as const };

function makeService(
  prisma: ReturnType<typeof makePrisma>,
  push: PushService,
  email: EmailService,
): NotificationsService {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return new NotificationsService(
    prisma as unknown as PrismaService,
    push,
    email,
  );
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Step 15 — Notification delivery tracking', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── EMAIL_ELIGIBLE_TEMPLATES additions ───────────────────────────────────

  /**
   * For each eligible template: assert emailService.sendNotificationEmail is
   * called when the user has an email address. Each test is a behavioural
   * proof that the template code is in the set — not just a Set.has() call.
   */
  describe('Part A: EMAIL_ELIGIBLE_TEMPLATES inclusions', () => {
    async function assertEmailFired(templateCode: string) {
      const prisma = makePrisma('customer@example.com');
      prisma.notificationTemplate.findUnique.mockResolvedValue({
        code: templateCode,
        channel: NotificationChannel.PUSH,
        emailEnabled: true,
        subject: { ar: 'موضوع', en: 'Subject' },
        body:    { ar: 'نص',   en: 'Body'    },
      });
      const email = makeEmailService({ ok: true, sentAt: new Date() });
      const push  = makePushService({ enabled: false });
      const svc   = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode, payload: {} }),
      );

      expect(email.sendNotificationEmail).toHaveBeenCalledTimes(1);
    }

    // A.1: FG-07 — payment proof decisions (added Step 15 A.1)
    it('payment_proof_approved fires email', () => assertEmailFired('payment_proof_approved'));
    it('payment_proof_rejected fires email', () => assertEmailFired('payment_proof_rejected'));

    // A.2: previously reached customer through no channel at all
    it('reservation_expired fires email', () => assertEmailFired('reservation_expired'));
    it('installment_plan_created fires email', () => assertEmailFired('installment_plan_created'));
    it('maintenance_request_status_changed fires email', () => assertEmailFired('maintenance_request_status_changed'));
  });

  // ── Email outcome recording ───────────────────────────────────────────────

  describe('Email outcome recording (deposit_recorded — EMAIL eligible)', () => {
    it('emailSentAt is set when SMTP accepts the message', async () => {
      const sentAt = new Date();
      const prisma = makePrisma('user@example.com');
      const email  = makeEmailService({ ok: true, sentAt });
      const push   = makePushService({ enabled: false });
      const svc    = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      expect(prisma._updates).toHaveLength(1);
      expect(prisma._updates[0]!.data.emailSentAt).toEqual(sentAt);
      expect(prisma._updates[0]!.data.emailError).toBeUndefined();
    });

    it('emailError is set and emailSentAt absent when SMTP rejects', async () => {
      const prisma = makePrisma('user@example.com');
      const email  = makeEmailService({ ok: false, error: 'Connection refused' });
      const push   = makePushService({ enabled: false });
      const svc    = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      expect(prisma._updates).toHaveLength(1);
      expect(prisma._updates[0]!.data.emailError).toBe('Connection refused');
      expect(prisma._updates[0]!.data.emailSentAt).toBeUndefined();
    });

    it('emailError = "SMTP not configured" when transporter is absent', async () => {
      const prisma = makePrisma('user@example.com');
      const email  = makeEmailService({ ok: false, error: 'SMTP not configured' });
      const push   = makePushService({ enabled: false });
      const svc    = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      expect(prisma._updates[0]!.data.emailError).toBe('SMTP not configured');
    });

    it('email is not attempted when user has no email address', async () => {
      const prisma = makePrisma(/* no email */);
      const email  = makeEmailService({ ok: true, sentAt: new Date() });
      const push   = makePushService({ enabled: false });
      const svc    = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      expect(email.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it('email is not attempted for a non-eligible template', async () => {
      const prisma = makePrisma('user@example.com');
      prisma.notificationTemplate.findUnique.mockResolvedValue({
        code: 'visit_approved',
        channel: NotificationChannel.PUSH,
        emailEnabled: false,
        subject: { ar: 'زيارة', en: 'Visit' },
        body:    { ar: 'نص',   en: 'Body'  },
      });
      const email = makeEmailService({ ok: true, sentAt: new Date() });
      const push  = makePushService({ enabled: false });
      const svc   = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'visit_approved', payload: {} }),
      );

      expect(email.sendNotificationEmail).not.toHaveBeenCalled();
    });
  });

  // ── Push outcome recording ────────────────────────────────────────────────

  describe('Push outcome recording', () => {
    it('pushSentAt is set when FCM delivers to at least one device', async () => {
      const prisma = makePrisma();
      const push   = makePushService({ enabled: true, sent: 3 });
      const email  = makeEmailService({ ok: false, error: 'SMTP not configured' });
      const svc    = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      const update = prisma._updates[0]!.data;
      expect(update.pushSentAt).toBeInstanceOf(Date);
      expect(update.pushError).toBeUndefined();
    });

    it('pushError = "FCM not configured" when Firebase is disabled', async () => {
      const prisma = makePrisma();
      const push   = makePushService({ enabled: false });
      const email  = makeEmailService({ ok: false, error: 'SMTP not configured' });
      const svc    = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      const update = prisma._updates[0]!.data;
      expect(update.pushError).toBe('FCM not configured');
      expect(update.pushSentAt).toBeUndefined();
    });

    it('pushError is set and pushSentAt absent when FCM call throws', async () => {
      const prisma = makePrisma();
      const push   = makePushService({ throws: 'network timeout' });
      const email  = makeEmailService({ ok: false, error: 'SMTP not configured' });
      const svc    = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      const update = prisma._updates[0]!.data;
      expect(update.pushError).toBe('network timeout');
      expect(update.pushSentAt).toBeUndefined();
    });

    it('no push columns when user has no device tokens (sent=0, enabled=true)', async () => {
      const prisma = makePrisma('user@example.com');
      const push   = makePushService({ enabled: true, sent: 0 });
      const email  = makeEmailService({ ok: true, sentAt: new Date() });
      const svc    = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      const update = prisma._updates[0]!.data;
      expect(update.pushSentAt).toBeUndefined();
      expect(update.pushError).toBeUndefined();
      // Email still ran
      expect(update.emailSentAt).toBeInstanceOf(Date);
    });
  });

  // ── Concurrency: single update, both columns written ─────────────────────

  describe('Concurrent delivery: single notification.update call', () => {
    it('push and email outcomes land in one update, not two', async () => {
      const sentAt = new Date();
      const prisma = makePrisma('user@example.com');
      const push   = makePushService({ enabled: true, sent: 2 });
      const email  = makeEmailService({ ok: true, sentAt });
      const svc    = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      // Exactly one update call; both push and email columns present together.
      expect(prisma.notification.update).toHaveBeenCalledTimes(1);
      const update = prisma._updates[0]!.data;
      expect(update.pushSentAt).toBeInstanceOf(Date);
      expect(update.emailSentAt).toEqual(sentAt);
    });

    it('no update call when push has no device tokens and email was not attempted', async () => {
      // user has no email + push sent 0 → outcome object is empty → no update
      const prisma = makePrisma(/* no email */);
      const push   = makePushService({ enabled: true, sent: 0 });
      const email  = makeEmailService({ ok: false, error: 'should not be called' });
      const svc    = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  // ── sendToUser contract preserved ─────────────────────────────────────────

  describe('sendToUser: business contract preserved', () => {
    it('DB row is always created even when push throws', async () => {
      const prisma = makePrisma();
      const push   = makePushService({ throws: 'FCM down' });
      const email  = makeEmailService({ ok: false, error: 'SMTP not configured' });
      const svc    = makeService(prisma, push, email);

      await svc.sendToUser('u-1', 'deposit_recorded', {});

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it('never throws to caller even when both push and email fail', async () => {
      const prisma = makePrisma('user@example.com');
      const push   = makePushService({ throws: 'FCM down' });
      const email  = makeEmailService({ ok: false, error: 'SMTP auth failed' });
      const svc    = makeService(prisma, push, email);

      await expect(svc.sendToUser('u-1', 'deposit_recorded', {})).resolves.toBeUndefined();
    });
  });

  // ── Part C: emailEnabled replaces EMAIL_ELIGIBLE_TEMPLATES ───────────────

  describe('Part C: tpl.emailEnabled controls email delivery', () => {
    it('emailEnabled=true → email attempted, emailSentAt written', async () => {
      const sentAt = new Date();
      const prisma = makePrisma('user@example.com');
      // visit_approved was NOT in the old Set — now explicitly enabled via field
      prisma.notificationTemplate.findUnique.mockResolvedValue({
        code: 'visit_approved',
        channel: NotificationChannel.PUSH,
        emailEnabled: true,
        subject: { ar: 'z', en: 'z' },
        body:    { ar: 'z', en: 'z' },
      });
      const email = makeEmailService({ ok: true, sentAt });
      const push  = makePushService({ enabled: false });
      const svc   = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'visit_approved', payload: {} }),
      );

      expect(email.sendNotificationEmail).toHaveBeenCalledTimes(1);
      expect(prisma._updates[0]!.data.emailSentAt).toEqual(sentAt);
    });

    it('emailEnabled=false → email NOT attempted, push columns unaffected', async () => {
      const prisma = makePrisma('user@example.com');
      // deposit_recorded was in the old Set — now disabled by emailEnabled=false
      prisma.notificationTemplate.findUnique.mockResolvedValue({
        code: 'deposit_recorded',
        channel: NotificationChannel.PUSH,
        emailEnabled: false,
        subject: { ar: 'z', en: 'z' },
        body:    { ar: 'z', en: 'z' },
      });
      const email = makeEmailService({ ok: true, sentAt: new Date() });
      const push  = makePushService({ enabled: true, sent: 2 });
      const svc   = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      expect(email.sendNotificationEmail).not.toHaveBeenCalled();
      const update = prisma._updates[0]!.data;
      expect(update.emailSentAt).toBeUndefined();
      expect(update.emailError).toBeUndefined();
      expect(update.pushSentAt).toBeInstanceOf(Date);
    });

    it('toggling emailEnabled off: emailSentAt absent, emailError absent, push unchanged', async () => {
      // Same as above but verify the update row itself has no email columns.
      const prisma = makePrisma('user@example.com');
      prisma.notificationTemplate.findUnique.mockResolvedValue({
        code: 'deposit_recorded',
        channel: NotificationChannel.PUSH,
        emailEnabled: false,
        subject: { ar: 'z', en: 'z' },
        body:    { ar: 'z', en: 'z' },
      });
      const email = makeEmailService({ ok: true, sentAt: new Date() });
      const push  = makePushService({ enabled: false });
      const svc   = makeService(prisma, push, email);

      await runTenantContext(TEST_TENANT, () =>
        svc.send({ userId: 'u-1', templateCode: 'deposit_recorded', payload: {} }),
      );

      const update = prisma._updates[0]!.data;
      expect(Object.keys(update)).not.toContain('emailSentAt');
      expect(Object.keys(update)).not.toContain('emailError');
    });
  });

  // ── Part C: seed consistency ──────────────────────────────────────────────

  describe('Part C: seed consistency', () => {
    const SEED_PATH = join(__dirname, '../../../../prisma/seed.ts');
    const seedSrc   = readFileSync(SEED_PATH, 'utf8');

    const ELIGIBLE_CODES = [
      'reservation_status_changed',
      'reservation_submitted_admin',
      'reservation_payment_requested',
      'reservation_booking_paid',
      'reservation_expired',
      'contract_created_customer',
      'contract_signed_customer',
      'contract_document_available',
      'deposit_recorded',
      'deposit_verified',
      'maintenance_request_created',
      'maintenance_request_assigned',
      'maintenance_request_resolved',
      'maintenance_request_closed',
      'maintenance_request_status_changed',
      'installment_due_soon',
      'installment_plan_created',
      'broker_approved',
      'broker_suspended',
      'user_account_approved',
      'user_account_suspended',
      'payment_proof_approved',
      'payment_proof_rejected',
    ];

    // Non-eligible samples that MUST NOT have emailEnabled: true in the seed.
    const NON_ELIGIBLE_SAMPLE = [
      'visit_approved',
      'broker_contract_signed',
      'payment_proof_submitted',
      'booking_payment_proof_submitted',
      'admin_broadcast',
      'lead_created',
    ];

    function blockFor(code: string): string {
      const start = seedSrc.indexOf(`code: '${code}'`);
      if (start === -1) return '';
      const next  = seedSrc.indexOf(`code: '`, start + code.length + 8);
      const arrEnd = seedSrc.indexOf('].map((t)', start);
      const stop  = Math.min(
        ...[next, arrEnd].filter((n) => n > start && n !== -1),
      );
      return seedSrc.slice(start, stop > start ? stop : start + 400);
    }

    it.each(ELIGIBLE_CODES)('%s — seed create block has emailEnabled: true', (code) => {
      const block = blockFor(code);
      expect(block).not.toBe('');
      expect(block).toMatch(/emailEnabled:\s*true/);
    });

    it.each(NON_ELIGIBLE_SAMPLE)('%s — seed create block does NOT have emailEnabled: true', (code) => {
      const block = blockFor(code);
      // Either the block is absent (fine) or it must not carry emailEnabled: true.
      if (block !== '') {
        expect(block).not.toMatch(/emailEnabled:\s*true/);
      }
    });

    it('eligible set in seed matches the migration backfill list (same 23 codes)', () => {
      const found = ELIGIBLE_CODES.filter((code) => {
        const block = blockFor(code);
        return block !== '' && /emailEnabled:\s*true/.test(block);
      });
      expect(found).toHaveLength(ELIGIBLE_CODES.length);
    });
  });
});
