import {
  Body,
  Controller,
  Get,
  Injectable,
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

@Injectable()
class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        templateCode: dto.templateCode,
        payload: (dto.payload ?? {}) as Prisma.InputJsonValue,
        channel,
        sentAt: new Date(),
      },
    });
  }

  listMine(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
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
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.svc.listMine(user.sub, unreadOnly === '1');
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
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
