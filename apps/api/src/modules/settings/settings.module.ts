import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Allow, IsObject, IsOptional, IsString } from 'class-validator';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

/**
 * Setting keys whose value should be masked on the wire. Matching is
 * case-insensitive substring on the key — `stripe.apiKey` matches `apikey`,
 * `notifications.webhookSecret` matches `secret`, etc.
 *
 * We mask the VALUE here at read time. The original is still stored
 * server-side and can be re-PATCHed by an admin who knows the new value;
 * we never round-trip the masked placeholder back through PATCH (see the
 * PATCH guard below).
 */
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'token',
  'apikey',
  'apisecret',
  'secret',
  'webhook',
  'privatekey',
];

const MASK = '***REDACTED***';

function isSensitiveKey(key: string): boolean {
  const lc = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((frag) => lc.includes(frag));
}

interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: Date;
}

interface SettingView extends SettingRow {
  group: string;
  sensitive: boolean;
}

function groupOf(key: string): string {
  const dot = key.indexOf('.');
  return dot > 0 ? key.slice(0, dot) : 'system';
}

function decorate(row: SettingRow): SettingView {
  const sensitive = isSensitiveKey(row.key);
  return {
    ...row,
    group: groupOf(row.key),
    sensitive,
    value: sensitive ? MASK : row.value,
  };
}

class UpsertSettingDto {
  // Existing PUT body shape — `value` must be an object or an array. We
  // keep this for backwards compat with the legacy admin UI/scripts.
  @IsObject()
  value!: Record<string, unknown> | unknown[];
}

class PatchSettingDto {
  // New PATCH body. Accepts any JSON value (string/number/bool/array/object).
  // @Allow() is required so the global whitelist pipe doesn't strip the field.
  @Allow()
  value!: unknown;
}

class SettingsQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() group?: string;
}

@Injectable()
class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: SettingsQueryDto): Promise<SettingView[]> {
    const rows = await this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
    let view = rows.map(decorate);
    if (query.group) {
      view = view.filter((r) => r.group === query.group);
    }
    if (query.q) {
      const needle = query.q.toLowerCase();
      view = view.filter((r) => r.key.toLowerCase().includes(needle));
    }
    return view;
  }

  async get(key: string): Promise<SettingView> {
    const s = await this.prisma.setting.findUnique({ where: { key } });
    if (!s) throw new NotFoundException(`Setting ${key} not found`);
    return decorate(s);
  }

  async upsert(key: string, value: Prisma.InputJsonValue): Promise<SettingView> {
    const row = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    return decorate(row);
  }

  /**
   * Guards against accidentally storing the redaction placeholder as the
   * literal value of a sensitive setting.
   */
  rejectMaskValue(value: unknown) {
    if (typeof value === 'string' && value === MASK) {
      throw new NotFoundException('Refusing to write redaction placeholder as a real value');
    }
  }
}

@ApiTags('settings')
@Controller('settings')
class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('settings:read')
  @Get()
  list(@Query() query: SettingsQueryDto) {
    return this.svc.list(query);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('settings:read')
  @Get(':key')
  get(@Param('key') key: string) {
    return this.svc.get(key);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('settings:write')
  @Put(':key')
  upsert(@Param('key') key: string, @Body() dto: UpsertSettingDto) {
    this.svc.rejectMaskValue(dto.value);
    return this.svc.upsert(key, dto.value as Prisma.InputJsonValue);
  }

  // Phase 16 — PATCH alias. Accepts any JSON shape (the legacy PUT only
  // accepted object/array). Same upsert semantics underneath.
  @Roles(UserRole.ADMIN)
  @Permissions('settings:write')
  @Patch(':key')
  patch(@Param('key') key: string, @Body() dto: PatchSettingDto) {
    this.svc.rejectMaskValue(dto.value);
    return this.svc.upsert(key, dto.value as Prisma.InputJsonValue);
  }
}

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
