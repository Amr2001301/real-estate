import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Injectable,
  Logger,
  Module,
  OnModuleInit,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Prisma, NotificationChannel, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveTenantUser } from '../../common/tenant/resolve-tenant-entity';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { PushService } from './push.service';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../auth/email.service';

class UpsertTemplateDto {
  @IsString() code!: string;
  @IsEnum(NotificationChannel) channel!: NotificationChannel;
  @IsString() ar_subject!: string;
  @IsString() en_subject!: string;
  @IsString() ar_body!: string;
  @IsString() en_body!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class SendNotificationDto {
  @IsUUID() userId!: string;
  @IsString() templateCode!: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
  @IsOptional() @IsEnum(NotificationChannel) channel?: NotificationChannel;
}

class RegisterDeviceDto {
  @IsString() token!: string;
  @IsString() platform!: string; // ios | android | web
}

/** Who the broadcast targets — used in BroadcastNotificationDto. */
export enum BroadcastTarget {
  USER = 'USER',
  ROLE = 'ROLE',
  ALL_CUSTOMERS = 'ALL_CUSTOMERS',
  ALL_BROKERS = 'ALL_BROKERS',
  ALL_SALES = 'ALL_SALES',
  ALL_MAINTENANCE_SUPERVISORS = 'ALL_MAINTENANCE_SUPERVISORS',
  ALL_ACTIVE = 'ALL_ACTIVE',
}

/**
 * Delivery channel for admin broadcasts. Separate from the Prisma
 * NotificationChannel to allow IN_APP_AND_PUSH without a DB migration.
 * String values intentionally match NotificationChannel where they overlap.
 *
 * IN_APP          → create Notification DB rows only. No FCM.
 * PUSH            → send FCM only. No DB rows. Requires Firebase.
 * IN_APP_AND_PUSH → create DB rows AND send FCM. Requires Firebase.
 *                   One DB row per recipient regardless of device count.
 */
export enum BroadcastChannel {
  IN_APP          = 'IN_APP',
  PUSH            = 'PUSH',
  IN_APP_AND_PUSH = 'IN_APP_AND_PUSH',
}

class BroadcastNotificationDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title_ar!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title_en!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) body_ar!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) body_en!: string;
  @IsEnum(BroadcastTarget) target!: BroadcastTarget;
  @IsOptional() @IsUUID() targetUserId?: string;
  @IsOptional() @IsEnum(UserRole) targetRole?: UserRole;
  @IsEnum(BroadcastChannel) channel!: BroadcastChannel;
  @IsOptional() @IsString() @MaxLength(60) entityType?: string;
  @IsOptional() @IsString() @MaxLength(36) entityId?: string;
}

/** Dry-run DTO — only the targeting fields; returns count without sending. */
class BroadcastPreviewDto {
  @IsEnum(BroadcastTarget) target!: BroadcastTarget;
  @IsOptional() @IsUUID() targetUserId?: string;
  @IsOptional() @IsEnum(UserRole) targetRole?: UserRole;
  /** When PUSH or IN_APP_AND_PUSH, also returns estimated device token counts. */
  @IsOptional() @IsEnum(BroadcastChannel) channel?: BroadcastChannel;
}

type Locale = 'ar' | 'en';

function pickLocale(header?: string): Locale {
  return (header ?? 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
}

/** Fills `{{var}}` placeholders from the notification payload. */
function interpolate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = payload[key];
    return v === null || v === undefined ? '' : String(v);
  });
}

interface TranslatableText {
  ar?: string;
  en?: string;
}

function resolveText(
  text: Prisma.JsonValue | null | undefined,
  payload: Record<string, unknown>,
  locale: Locale,
  fallback: string,
): string {
  const t = (text ?? {}) as TranslatableText;
  const raw = t[locale] ?? t.ar ?? t.en ?? fallback;
  return interpolate(raw, payload);
}

/** Template codes for which an email is also dispatched (best-effort). */
const EMAIL_ELIGIBLE_TEMPLATES = new Set([
  'reservation_status_changed',
  'reservation_submitted_admin',
  'reservation_payment_requested',
  'reservation_booking_paid',
  'contract_created_customer',
  'contract_signed_customer',
  'contract_document_available',
  'deposit_recorded',
  'deposit_verified',
  'maintenance_request_created',
  'maintenance_request_assigned',
  'maintenance_request_resolved',
  'maintenance_request_closed',
  'installment_due_soon',
  'broker_approved',
  'broker_suspended',
  'user_account_approved',
  'user_account_suspended',
]);

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly email: EmailService,
  ) {}

  /**
   * Ensures the `admin_broadcast` passthrough template always exists in the
   * database, independent of whether the seed script has been run.
   * The template body is intentionally `{{var}}` — content is interpolated at
   * send-time from the broadcast payload.
   */
  async onModuleInit() {
    try {
      await this.prisma.notificationTemplate.upsert({
        where: { code: 'admin_broadcast' },
        create: {
          code: 'admin_broadcast',
          channel: NotificationChannel.IN_APP,
          subject: { ar: '{{title_ar}}', en: '{{title_en}}' } as Prisma.InputJsonValue,
          body:    { ar: '{{body_ar}}',  en: '{{body_en}}'  } as Prisma.InputJsonValue,
        },
        update: {},
      });
      this.logger.log('admin_broadcast template verified');
    } catch (err) {
      // Non-fatal: log and continue — send() will fail with a clear message if
      // the template is still missing (e.g. DB not yet migrated).
      this.logger.error(`admin_broadcast template upsert failed: ${(err as Error).message}`);
    }
  }

  async upsertTemplate(dto: UpsertTemplateDto) {
    const companyId = getRequiredCompanyId();

    // Guard: code has a global @unique constraint (schema migration pending).
    // Use $queryRaw to bypass the tenant middleware and detect cross-tenant conflicts
    // before the upsert would hit a unique constraint violation.
    const conflicts = await this.prisma.$queryRaw<Array<{ companyId: string | null }>>`
      SELECT "companyId" FROM "NotificationTemplate" WHERE code = ${dto.code} LIMIT 1
    `;
    const first = conflicts[0];
    if (first && first.companyId !== companyId) {
      throw new ForbiddenException(
        `Notification template code '${dto.code}' belongs to another tenant.`,
      );
    }

    return this.prisma.notificationTemplate.upsert({
      where: { code: dto.code },
      create: {
        code: dto.code,
        channel: dto.channel,
        subject: { ar: dto.ar_subject, en: dto.en_subject } as Prisma.InputJsonValue,
        body: { ar: dto.ar_body, en: dto.en_body } as Prisma.InputJsonValue,
        active: dto.active ?? true,
      },
      update: {
        channel: dto.channel,
        subject: { ar: dto.ar_subject, en: dto.en_subject } as Prisma.InputJsonValue,
        body: { ar: dto.ar_body, en: dto.en_body } as Prisma.InputJsonValue,
        active: dto.active ?? undefined,
      },
    });
  }

  listTemplates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  /**
   * Fan-out helper used by business modules to deliver a notification without
   * coupling them to the underlying send/push/template machinery.
   *
   * - DB row is always created (best-effort: any thrown error is logged and
   *   swallowed so the caller's business action never fails).
   * - Push is attempted via [send] and is already best-effort there.
   * - Returns void; recipient resolution / lookup errors do not propagate.
   */
  async sendToUser(
    userId: string | null | undefined,
    templateCode: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    if (!userId) return; // safe skip — recipient missing
    try {
      await this.send({ userId, templateCode, payload });
    } catch (err) {
      this.logger.warn(
        `Notification send failed (${templateCode}): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Deliver one notification to many recipients. Deduplicates user ids so a
   * customer who's also flagged as a recipient through some other path never
   * sees the same notification twice. Empty / null entries are silently
   * dropped. Each per-user send is independent — one failure does not abort
   * the rest.
   */
  async sendToUsers(
    userIds: ReadonlyArray<string | null | undefined>,
    templateCode: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    const unique = Array.from(
      new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
    );
    if (unique.length === 0) return;
    await Promise.all(
      unique.map((userId) => this.sendToUser(userId, templateCode, payload)),
    );
  }

  /**
   * Resolve recipients by role and deliver to each. Inactive users are
   * skipped. Used for the "notify all admins" / "notify sales managers" fan-
   * outs that visit lifecycle events trigger. Like the other helpers, this
   * never throws past the caller.
   */
  async sendToRoles(
    roles: ReadonlyArray<UserRole>,
    templateCode: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    if (roles.length === 0) return;
    try {
      // eslint-disable-next-line no-restricted-syntax -- bulk role query, not an external-ID lookup; no IDOR risk
      const users = await this.prisma.user.findMany({
        where: { role: { in: [...roles] }, active: true },
        select: { id: true },
      });
      await this.sendToUsers(users.map((u) => u.id), templateCode, payload);
    } catch (err) {
      this.logger.warn(
        `Notification fan-out failed (${templateCode}): ${(err as Error).message}`,
      );
    }
  }

  async send(dto: SendNotificationDto) {
    const tpl = await this.prisma.notificationTemplate.findUnique({
      where: { code: dto.templateCode },
    });
    if (!tpl) throw new Error(`Template ${dto.templateCode} not found`);
    const channel = dto.channel ?? tpl.channel;
    const payload = (dto.payload ?? {}) as Record<string, unknown>;

    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        templateCode: dto.templateCode,
        payload: payload as Prisma.InputJsonValue,
        channel,
        sentAt: new Date(),
      },
    });

    // Best-effort push + email in the recipient's locale; never fail the write.
    try {
      const user = await resolveTenantUser(
        this.prisma,
        dto.userId,
        { locale: true, email: true },
      );
      const locale = pickLocale(user?.locale ?? 'ar');
      // FCM data values must all be strings. Include entityType/entityId so
      // the mobile app can deep-link directly from the push tap without a
      // separate API call. Never include sensitive fields.
      const fcmData: Record<string, string> = {
        templateCode: dto.templateCode,
        notificationId: notification.id,
      };
      if (payload.entityType && typeof payload.entityType === 'string') {
        fcmData['entityType'] = payload.entityType;
      }
      if (payload.entityId && typeof payload.entityId === 'string') {
        fcmData['entityId'] = payload.entityId;
      }
      await this.push.sendToUser(dto.userId, {
        title: resolveText(tpl.subject, payload, locale, dto.templateCode),
        body: resolveText(tpl.body, payload, locale, ''),
        data: fcmData,
      });

      // Email fan-out for key domain events — best-effort alongside push.
      if (user?.email && EMAIL_ELIGIBLE_TEMPLATES.has(dto.templateCode)) {
        const subject = resolveText(tpl.subject, payload, locale, dto.templateCode);
        const bodyText = resolveText(tpl.body, payload, locale, '');
        const htmlBody = `
          <div dir="${locale === 'ar' ? 'rtl' : 'ltr'}" style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#1a1a2e;">
            <h2 style="margin:0 0 16px;color:#0F1E33;">${subject}</h2>
            <p style="margin:0 0 24px;line-height:1.7;">${bodyText}</p>
            <hr style="margin:28px 0;border:none;border-top:1px solid #eee;"/>
            <p style="margin:0;font-size:12px;color:#999;">© ديفورا — منصة الإدارة العقارية</p>
          </div>`;
        void this.email.sendNotificationEmail(user.email, subject, htmlBody);
      }
    } catch (err) {
      this.logger.warn(
        `Push delivery failed for ${dto.templateCode}: ${(err as Error).message}`,
      );
    }

    return notification;
  }

  async listMine(
    userId: string,
    opts: { unreadOnly: boolean; page: number; pageSize: number; locale: Locale },
  ) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...takeSkip(opts),
      }),
      this.prisma.notification.count({ where }),
    ]);

    // Resolve titles/bodies from templates (batched) in the requested locale.
    const codes = [...new Set(rows.map((r) => r.templateCode))];
    const templates = await this.prisma.notificationTemplate.findMany({
      where: { code: { in: codes } },
    });
    const byCode = new Map(templates.map((t) => [t.code, t]));

    const data = rows.map((r) => {
      const tpl = byCode.get(r.templateCode);
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        templateCode: r.templateCode,
        title: resolveText(tpl?.subject, payload, opts.locale, r.templateCode),
        body: resolveText(tpl?.body, payload, opts.locale, ''),
        payload: r.payload,
        channel: r.channel,
        read: r.readAt !== null,
        createdAt: r.createdAt,
      };
    });

    return paginate(data, total, opts);
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const result = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { userId, platform: dto.platform },
    });
    this.logger.log(`[DeviceToken] registered for user ${userId} platform=${dto.platform}`);
    return result;
  }

  unregisterDevice(token: string) {
    return this.prisma.deviceToken.deleteMany({ where: { token } });
  }

  /**
   * Admin manual broadcast. Channel determines the delivery path strictly:
   *
   * IN_APP          → create one Notification DB row per recipient. No FCM.
   * PUSH            → send FCM per recipient. No DB rows. Requires Firebase.
   * IN_APP_AND_PUSH → create DB rows AND send FCM. Requires Firebase.
   *                   One DB row per user regardless of how many devices they have.
   *
   * Paths are strictly separated — no silent fallback ever occurs.
   * Audit: every payload carries broadcastId, sentBy, broadcastAt,
   * targetType, and targetValue for traceability.
   */
  async broadcastNotification(
    adminId: string,
    dto: BroadcastNotificationDto,
  ): Promise<{
    broadcastId: string;
    channel: BroadcastChannel;
    recipientCount: number;
    // IN_APP + IN_APP_AND_PUSH
    notificationRecordsCreated?: number;
    failed?: number;
    // PUSH + IN_APP_AND_PUSH
    pushSent?: number;
    pushFailed?: number;
    noDeviceTokens?: number;
    failureHint?: string;
  }> {
    // Guard: PUSH and IN_APP_AND_PUSH require Firebase. Block before any DB writes
    // so the admin gets a clear error rather than silent non-delivery.
    const needsPush = dto.channel === BroadcastChannel.PUSH ||
                      dto.channel === BroadcastChannel.IN_APP_AND_PUSH;
    if (needsPush && !this.push.pushEnabled) {
      throw new BadRequestException(
        `${dto.channel} channel requires Firebase — not configured or the API was not ` +
        `restarted after adding FIREBASE_* credentials. Use IN_APP to skip push.`,
      );
    }

    const broadcastId = randomUUID();
    const userIds = await this.resolveRecipients(dto.target, dto.targetUserId, dto.targetRole);

    if (userIds.length === 0) {
      return { broadcastId, channel: dto.channel, recipientCount: 0 };
    }

    // Audit payload carried inside every Notification row / FCM data envelope.
    const auditPayload: Record<string, unknown> = {
      title_ar: dto.title_ar,
      title_en: dto.title_en,
      body_ar: dto.body_ar,
      body_en: dto.body_en,
      sentBy: adminId,
      broadcastAt: new Date().toISOString(),
      broadcastId,
      targetType: dto.target,
      targetValue: dto.targetUserId ?? dto.targetRole ?? dto.target,
      ...(dto.entityType ? { entityType: dto.entityType } : {}),
      ...(dto.entityId ? { entityId: dto.entityId } : {}),
    };

    // ── IN_APP path ───────────────────────────────────────────────────────────
    if (dto.channel === BroadcastChannel.IN_APP) {
      const tpl = await this.prisma.notificationTemplate.findUnique({
        where: { code: 'admin_broadcast' },
      });
      if (!tpl) {
        throw new BadRequestException(
          'Template admin_broadcast not found in the database — restart the API to auto-create it.',
        );
      }

      const results = await Promise.allSettled(
        userIds.map((userId) =>
          this.prisma.notification.create({
            data: {
              userId,
              templateCode: 'admin_broadcast',
              payload: auditPayload as Prisma.InputJsonValue,
              channel: NotificationChannel.IN_APP,
              sentAt: new Date(),
            },
          }),
        ),
      );

      const notificationRecordsCreated = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed > 0) {
        (results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')).forEach(
          (r, i) => this.logger.warn(
            `Broadcast ${broadcastId} IN_APP[${i}] failed: ${(r.reason as Error).message}`,
          ),
        );
      }

      this.logger.log(
        `Broadcast ${broadcastId} by ${adminId}: IN_APP target=${dto.target} ` +
        `recipients=${userIds.length} created=${notificationRecordsCreated} failed=${failed}`,
      );

      return {
        broadcastId,
        channel: BroadcastChannel.IN_APP,
        recipientCount: userIds.length,
        notificationRecordsCreated,
        failed,
        ...(failed > 0 ? { failureHint: 'database_error' } : {}),
      };
    }

    // ── Shared push helper ────────────────────────────────────────────────────
    // Used by PUSH and IN_APP_AND_PUSH paths.
    const buildPushResults = async (
      ids: string[],
      notifIdByUser: Map<string, string>,
    ) => {
      // eslint-disable-next-line no-restricted-syntax -- bulk IDs supplied by this service, not from external input
      const usersWithLocale = await this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, locale: true },
      });
      const localeMap = new Map(
        usersWithLocale.map((u) => [u.id, pickLocale(u.locale ?? 'ar')]),
      );

      return Promise.allSettled(
        ids.map((userId) => {
          const locale = localeMap.get(userId) ?? 'ar';
          const fcmData: Record<string, string> = {
            broadcastId,
            templateCode: 'admin_broadcast',
          };
          const notifId = notifIdByUser.get(userId);
          if (notifId)       fcmData['notificationId'] = notifId;
          if (dto.entityType) fcmData['entityType']    = dto.entityType;
          if (dto.entityId)   fcmData['entityId']      = dto.entityId;
          return this.push.sendToUser(userId, {
            title: locale === 'en' ? dto.title_en : dto.title_ar,
            body:  locale === 'en' ? dto.body_en  : dto.body_ar,
            data:  fcmData,
          });
        }),
      );
    };

    const tallyCounts = (
      results: PromiseSettledResult<Awaited<ReturnType<PushService['sendToUser']>>>[],
      label: string,
    ) => {
      let pushSent = 0, pushFailed = 0, noDeviceTokens = 0;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const res = r.value;
          if (!res.enabled)                        pushFailed++;
          else if (res.sent === 0 && res.failed === 0) noDeviceTokens++;
          else { pushSent += res.sent; pushFailed += res.failed; }
        } else {
          pushFailed++;
          this.logger.warn(`Broadcast ${broadcastId} ${label} PUSH: ${(r.reason as Error).message}`);
        }
      }
      return { pushSent, pushFailed, noDeviceTokens };
    };

    // ── PUSH path ─────────────────────────────────────────────────────────────
    // Firebase confirmed enabled. No Notification DB rows — delivery only.
    if (dto.channel === BroadcastChannel.PUSH) {
      const rawResults = await buildPushResults(userIds, new Map());
      const { pushSent, pushFailed, noDeviceTokens } = tallyCounts(rawResults, 'PUSH');

      this.logger.log(
        `Broadcast ${broadcastId} by ${adminId}: PUSH target=${dto.target} ` +
        `recipients=${userIds.length} pushSent=${pushSent} pushFailed=${pushFailed} noDeviceTokens=${noDeviceTokens}`,
      );

      const failureHint =
        noDeviceTokens === userIds.length ? 'no_device_tokens' :
        pushFailed > 0                    ? 'push_failed'       : undefined;

      return {
        broadcastId,
        channel: BroadcastChannel.PUSH,
        recipientCount: userIds.length,
        pushSent,
        pushFailed,
        noDeviceTokens,
        ...(failureHint ? { failureHint } : {}),
      };
    }

    // ── IN_APP_AND_PUSH path ──────────────────────────────────────────────────
    // Phase 1: create one Notification DB row per recipient (channel=IN_APP).
    const tpl2 = await this.prisma.notificationTemplate.findUnique({
      where: { code: 'admin_broadcast' },
    });
    if (!tpl2) {
      throw new BadRequestException(
        'Template admin_broadcast not found — restart the API to auto-create it.',
      );
    }

    const dbResults2 = await Promise.allSettled(
      userIds.map((userId) =>
        this.prisma.notification.create({
          data: {
            userId,
            templateCode: 'admin_broadcast',
            payload: auditPayload as Prisma.InputJsonValue,
            channel: NotificationChannel.IN_APP,
            sentAt: new Date(),
          },
        }),
      ),
    );

    let notificationRecordsCreated2 = 0;
    let dbFailed = 0;
    const notifIdByUser = new Map<string, string>();

    for (const [i, r] of dbResults2.entries()) {
      if (r.status === 'fulfilled') {
        notificationRecordsCreated2++;
        notifIdByUser.set(userIds[i]!, r.value.id);
      } else {
        dbFailed++;
        this.logger.warn(
          `Broadcast ${broadcastId} IN_APP+PUSH DB[${i}]: ${(r.reason as Error).message}`,
        );
      }
    }

    // Phase 2: send FCM (best-effort, including notificationId for deep-link).
    const rawResults2 = await buildPushResults(userIds, notifIdByUser);
    const { pushSent: ps2, pushFailed: pf2, noDeviceTokens: nd2 } =
      tallyCounts(rawResults2, 'IN_APP+PUSH');

    this.logger.log(
      `Broadcast ${broadcastId} by ${adminId}: IN_APP+PUSH target=${dto.target} ` +
      `recipients=${userIds.length} dbCreated=${notificationRecordsCreated2} dbFailed=${dbFailed} ` +
      `pushSent=${ps2} pushFailed=${pf2} noDeviceTokens=${nd2}`,
    );

    const failureHint2 =
      nd2 === userIds.length && ps2 === 0 ? 'no_device_tokens' :
      pf2 > 0 || dbFailed > 0            ? 'push_failed'       : undefined;

    return {
      broadcastId,
      channel: BroadcastChannel.IN_APP_AND_PUSH,
      recipientCount: userIds.length,
      notificationRecordsCreated: notificationRecordsCreated2,
      failed: dbFailed,
      pushSent: ps2,
      pushFailed: pf2,
      noDeviceTokens: nd2,
      ...(failureHint2 ? { failureHint: failureHint2 } : {}),
    };
  }

  /**
   * Dry-run preview — resolves recipient count without sending anything.
   * When channel=PUSH also counts registered device tokens so the admin
   * can see how many recipients have no device before sending.
   */
  async previewBroadcast(dto: BroadcastPreviewDto): Promise<{
    recipientCount: number;
    pushEnabled: boolean;
    estimatedDeviceCount?: number;
    usersWithoutDevices?: number;
  }> {
    const userIds = await this.resolveRecipients(dto.target, dto.targetUserId, dto.targetRole);
    const base = { recipientCount: userIds.length, pushEnabled: this.push.pushEnabled };

    const needsDeviceInfo = dto.channel === BroadcastChannel.PUSH ||
                            dto.channel === BroadcastChannel.IN_APP_AND_PUSH;
    if (!needsDeviceInfo || userIds.length === 0) {
      return base;
    }

    // Count device tokens so the admin can see device coverage before sending.
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
    });
    const usersWithDevices = new Set(tokens.map((t) => t.userId));
    return {
      ...base,
      estimatedDeviceCount: tokens.length,
      usersWithoutDevices: userIds.filter((id) => !usersWithDevices.has(id)).length,
    };
  }

  private async resolveRecipients(
    target: BroadcastTarget,
    targetUserId?: string,
    targetRole?: UserRole,
  ): Promise<string[]> {
    switch (target) {
      case BroadcastTarget.USER:
        if (!targetUserId) throw new BadRequestException('targetUserId required when target is USER');
        return [targetUserId];
      case BroadcastTarget.ROLE:
        if (!targetRole) throw new BadRequestException('targetRole required when target is ROLE');
        return this.activeUserIdsByRole([targetRole]);
      case BroadcastTarget.ALL_CUSTOMERS:
        return this.activeUserIdsByRole([UserRole.CUSTOMER]);
      case BroadcastTarget.ALL_BROKERS:
        return this.activeUserIdsByRole([UserRole.BROKER]);
      case BroadcastTarget.ALL_SALES:
        return this.activeUserIdsByRole([UserRole.SALES]);
      case BroadcastTarget.ALL_MAINTENANCE_SUPERVISORS:
        return this.activeUserIdsByRole([UserRole.MAINTENANCE_SUPERVISOR]);
      case BroadcastTarget.ALL_ACTIVE: {
        // eslint-disable-next-line no-restricted-syntax -- broadcast to all active users (no external-ID IDOR risk)
        const users = await this.prisma.user.findMany({ where: { active: true }, select: { id: true } });
        return users.map((u) => u.id);
      }
      default:
        throw new BadRequestException('Invalid broadcast target');
    }
  }

  private async activeUserIdsByRole(roles: UserRole[]): Promise<string[]> {
    // eslint-disable-next-line no-restricted-syntax -- bulk role query, not an external-ID lookup; no IDOR risk
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles }, active: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
}

@ApiTags('notifications')
@Controller()
class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('notifications:templates:manage')
  @Get('notification-templates')
  listTemplates() {
    return this.svc.listTemplates();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('notifications:templates:manage')
  @Post('notification-templates')
  upsertTemplate(@Body() dto: UpsertTemplateDto) {
    return this.svc.upsertTemplate(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('notifications:send')
  @Post('notifications/send')
  send(@Body() dto: SendNotificationDto) {
    return this.svc.send(dto);
  }

  /**
   * Dry-run preview: resolves recipient count without sending any notifications.
   * Must be declared before /broadcast to avoid route collision.
   */
  @Roles(UserRole.ADMIN)
  @Permissions('notifications:send')
  @Post('notifications/broadcast/preview')
  previewBroadcast(@Body() dto: BroadcastPreviewDto) {
    return this.svc.previewBroadcast(dto);
  }

  /**
   * Admin manual broadcast — sends to a resolved audience and returns a
   * delivery summary. Requires notifications:send permission.
   */
  @Roles(UserRole.ADMIN)
  @Permissions('notifications:send')
  @Post('notifications/broadcast')
  broadcast(@CurrentUser() user: AuthUser, @Body() dto: BroadcastNotificationDto) {
    return this.svc.broadcastNotification(user.sub, dto);
  }

  @Get('me/notifications')
  myList(
    @CurrentUser() user: AuthUser,
    @Headers('accept-language') acceptLanguage?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.listMine(user.sub, {
      unreadOnly: unreadOnly === '1',
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      locale: pickLocale(acceptLanguage),
    });
  }

  @Get('me/notifications/unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.svc.unreadCount(user.sub);
  }

  @Patch('me/notifications/:id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markRead(user.sub, id);
  }

  @Patch('me/notifications/read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.svc.markAllRead(user.sub);
  }

  @Post('me/devices')
  registerDevice(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.svc.registerDevice(user.sub, dto);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService, FirebaseService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
