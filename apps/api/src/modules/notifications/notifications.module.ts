import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { PushService } from './push.service';

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

class BroadcastNotificationDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title_ar!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title_en!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) body_ar!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) body_en!: string;
  @IsEnum(BroadcastTarget) target!: BroadcastTarget;
  @IsOptional() @IsUUID() targetUserId?: string;
  @IsOptional() @IsEnum(UserRole) targetRole?: UserRole;
  @IsEnum(NotificationChannel) channel!: NotificationChannel;
  @IsOptional() @IsString() @MaxLength(60) entityType?: string;
  @IsOptional() @IsString() @MaxLength(36) entityId?: string;
}

/** Dry-run DTO — only the targeting fields; returns count without sending. */
class BroadcastPreviewDto {
  @IsEnum(BroadcastTarget) target!: BroadcastTarget;
  @IsOptional() @IsUUID() targetUserId?: string;
  @IsOptional() @IsEnum(UserRole) targetRole?: UserRole;
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

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
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

  upsertTemplate(dto: UpsertTemplateDto) {
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

    // Best-effort push in the recipient's locale; never fail the write on it.
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { locale: true },
      });
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

  registerDevice(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { userId, platform: dto.platform },
    });
  }

  unregisterDevice(token: string) {
    return this.prisma.deviceToken.deleteMany({ where: { token } });
  }

  /**
   * Admin manual broadcast. Resolves recipients by target, creates one
   * Notification record per user via the `admin_broadcast` passthrough
   * template (content interpolated from payload vars), and attempts push.
   *
   * PUSH guard: PUSH channel is rejected when Firebase is not configured so
   * the admin gets an explicit error rather than silent no-op delivery.
   *
   * Audit: every notification's payload carries broadcastId, sentBy,
   * broadcastAt, targetType, and targetValue for traceability.
   */
  async broadcastNotification(
    adminId: string,
    dto: BroadcastNotificationDto,
  ): Promise<{ broadcastId: string; recipientCount: number; sent: number; failed: number; failureHint?: string }> {
    // Reject PUSH explicitly when Firebase is not configured — silent no-op
    // would mislead the admin into thinking the push was delivered.
    if (dto.channel === NotificationChannel.PUSH && !this.push.pushEnabled) {
      throw new BadRequestException(
        'PUSH channel requires Firebase configuration. Select IN_APP instead, or configure Firebase credentials.',
      );
    }

    const broadcastId = randomUUID();
    const userIds = await this.resolveRecipients(dto.target, dto.targetUserId, dto.targetRole);

    if (userIds.length === 0) {
      return { broadcastId, recipientCount: 0, sent: 0, failed: 0 };
    }

    const payload: Record<string, unknown> = {
      title_ar: dto.title_ar,
      title_en: dto.title_en,
      body_ar: dto.body_ar,
      body_en: dto.body_en,
      sentBy: adminId,
      broadcastAt: new Date().toISOString(),
      broadcastId,
      // Audit: which target was used + its value (role name or user UUID)
      targetType: dto.target,
      targetValue: dto.targetUserId ?? dto.targetRole ?? dto.target,
      ...(dto.entityType ? { entityType: dto.entityType } : {}),
      ...(dto.entityId ? { entityId: dto.entityId } : {}),
    };

    const results = await Promise.allSettled(
      userIds.map((userId) =>
        this.send({ userId, templateCode: 'admin_broadcast', payload, channel: dto.channel }),
      ),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const rejections = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    const failed = rejections.length;

    // Log each failure reason server-side without exposing PII.
    if (failed > 0) {
      rejections.forEach((r, i) => {
        this.logger.warn(
          `Broadcast ${broadcastId} recipient[${i}] failed: ${(r.reason as Error).message ?? r.reason}`,
        );
      });
    }

    this.logger.log(
      `Broadcast ${broadcastId} by admin ${adminId}: ` +
      `target=${dto.target} recipients=${userIds.length} sent=${sent} failed=${failed}`,
    );

    // Classify the dominant failure type for UI display — no sensitive data.
    let failureHint: string | undefined;
    if (failed > 0) {
      const msgs = rejections.map((r) => String((r.reason as Error).message ?? '').toLowerCase());
      if (msgs.some((m) => m.includes('not found'))) {
        failureHint = 'template_missing';
      } else if (msgs.some((m) => m.includes('firebase') || m.includes('fcm') || m.includes('push'))) {
        failureHint = 'push_not_configured';
      } else {
        failureHint = 'database_error';
      }
    }

    return { broadcastId, recipientCount: userIds.length, sent, failed, failureHint };
  }

  /**
   * Dry-run preview — resolves recipient count without sending anything.
   * Also returns whether Firebase push is currently enabled.
   */
  async previewBroadcast(
    dto: BroadcastPreviewDto,
  ): Promise<{ recipientCount: number; pushEnabled: boolean }> {
    const userIds = await this.resolveRecipients(dto.target, dto.targetUserId, dto.targetRole);
    return { recipientCount: userIds.length, pushEnabled: this.push.pushEnabled };
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
        const users = await this.prisma.user.findMany({ where: { active: true }, select: { id: true } });
        return users.map((u) => u.id);
      }
      default:
        throw new BadRequestException('Invalid broadcast target');
    }
  }

  private async activeUserIdsByRole(roles: UserRole[]): Promise<string[]> {
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
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService, FirebaseService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
