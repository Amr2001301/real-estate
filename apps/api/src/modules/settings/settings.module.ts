import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';

class UpsertSettingDto {
  @IsObject()
  value!: Record<string, unknown> | unknown[];
}

@Injectable()
class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.setting.findMany();
  }

  async get(key: string) {
    const s = await this.prisma.setting.findUnique({ where: { key } });
    if (!s) throw new NotFoundException(`Setting ${key} not found`);
    return s;
  }

  upsert(key: string, value: Prisma.InputJsonValue) {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}

@ApiTags('settings')
@Controller('settings')
class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  list() {
    return this.svc.list();
  }

  @Roles(UserRole.ADMIN)
  @Get(':key')
  get(@Param('key') key: string) {
    return this.svc.get(key);
  }

  @Roles(UserRole.ADMIN)
  @Put(':key')
  upsert(@Param('key') key: string, @Body() dto: UpsertSettingDto) {
    return this.svc.upsert(key, dto.value as Prisma.InputJsonValue);
  }
}

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
