import {
  Body,
  Controller,
  Get,
  Headers,
  Injectable,
  Logger,
  Module,
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
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
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
class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

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
      await this.push.sendToUser(dto.userId, {
        title: resolveText(tpl.subject, payload, locale, dto.templateCode),
        body: resolveText(tpl.body, payload, locale, ''),
        data: { templateCode: dto.templateCode, notificationId: notification.id },
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
