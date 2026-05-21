import {
  Body,
  Controller,
  Get,
  Header,
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
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Prisma, BonusEntryStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toCsv } from '../../common/utils/csv';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions, PermissionsStrict } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class CreateRuleDto {
  @IsString() name!: string;
  @IsNumber() @Min(0) @Max(100) percentage!: number;
  @IsOptional() @IsObject() conditions?: Record<string, unknown>;
  @IsOptional() @IsBoolean() active?: boolean;
}

class CreateEntryDto {
  @IsUUID() salesId!: string;
  @IsUUID() ruleId!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsString() period!: string; // YYYY-MM
}

/**
 * PATCH /bonus-entries/:id is now the revert-to-PENDING route only.
 * APPROVED and PAID transitions live on their dedicated POST endpoints
 * (gated by @PermissionsStrict). The global ValidationPipe's
 * forbidNonWhitelisted + IsIn enforcement rejects other values with 400.
 */
class UpdateEntryStatusDto {
  @IsIn([BonusEntryStatus.PENDING]) status!: BonusEntryStatus;
}

class CreateTargetDto {
  @IsUUID() salesId!: string;
  @IsString() period!: string;
  @IsNumber() @Min(0) amountTarget!: number;
  @IsNumber() @Min(0) unitsTarget!: number;
}

@Injectable()
class BonusService {
  constructor(private readonly prisma: PrismaService) {}

  // Rules
  listRules() {
    return this.prisma.bonusRule.findMany({ orderBy: { createdAt: 'desc' } });
  }
  createRule(dto: CreateRuleDto) {
    return this.prisma.bonusRule.create({
      data: {
        name: dto.name,
        percentage: new Prisma.Decimal(dto.percentage),
        conditions: (dto.conditions ?? {}) as Prisma.InputJsonValue,
        active: dto.active ?? true,
      },
    });
  }

  // Entries
  createEntry(dto: CreateEntryDto) {
    return this.prisma.bonusEntry.create({
      data: {
        salesId: dto.salesId,
        ruleId: dto.ruleId,
        amount: new Prisma.Decimal(dto.amount),
        period: dto.period,
      },
    });
  }

  listEntries(opts: { salesId?: string; status?: BonusEntryStatus; period?: string }) {
    return this.prisma.bonusEntry.findMany({
      where: {
        ...(opts.salesId ? { salesId: opts.salesId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.period ? { period: opts.period } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { sales: { select: { id: true, fullName: true } }, rule: true },
    });
  }

  async entriesCsv(opts: { salesId?: string; status?: BonusEntryStatus; period?: string }) {
    const entries = await this.listEntries(opts);
    const statusLabel: Record<BonusEntryStatus, string> = {
      [BonusEntryStatus.PENDING]: 'معلق',
      [BonusEntryStatus.APPROVED]: 'معتمد',
      [BonusEntryStatus.PAID]: 'مدفوع',
    };
    const rows = entries.map((e) => [
      e.sales?.fullName ?? '',
      e.period,
      e.rule?.name ?? '',
      Number(e.amount),
      statusLabel[e.status],
      e.paidAt ? e.paidAt.toISOString().slice(0, 10) : '',
    ]);
    return toCsv(
      ['المندوب', 'الفترة', 'القاعدة', 'المبلغ', 'الحالة', 'تاريخ الدفع'],
      rows,
    );
  }

  setEntryStatus(id: string, dto: UpdateEntryStatusDto) {
    return this.prisma.bonusEntry.update({
      where: { id },
      data: {
        status: dto.status,
        paidAt: dto.status === BonusEntryStatus.PAID ? new Date() : null,
      },
    });
  }

  // Targets
  upsertTarget(dto: CreateTargetDto) {
    return this.prisma.salesTarget.upsert({
      where: { salesId_period: { salesId: dto.salesId, period: dto.period } },
      create: {
        salesId: dto.salesId,
        period: dto.period,
        amountTarget: new Prisma.Decimal(dto.amountTarget),
        unitsTarget: dto.unitsTarget,
      },
      update: {
        amountTarget: new Prisma.Decimal(dto.amountTarget),
        unitsTarget: dto.unitsTarget,
      },
    });
  }

  listTargets(salesId?: string) {
    return this.prisma.salesTarget.findMany({
      where: salesId ? { salesId } : {},
      orderBy: { period: 'desc' },
      include: { sales: { select: { id: true, fullName: true } } },
    });
  }
}

@ApiTags('bonus')
@Controller()
class BonusController {
  constructor(private readonly svc: BonusService) {}

  // Rules
  @Roles(UserRole.ADMIN)
  @Permissions('bonus:rules:manage')
  @Get('bonus-rules')
  listRules() {
    return this.svc.listRules();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('bonus:rules:manage')
  @Post('bonus-rules')
  createRule(@Body() dto: CreateRuleDto) {
    return this.svc.createRule(dto);
  }

  // Entries
  @Roles(UserRole.ADMIN)
  @Permissions('bonus:entries:create')
  @Post('bonus-entries')
  createEntry(@Body() dto: CreateEntryDto) {
    return this.svc.createEntry(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Permissions('bonus:entries:read')
  @Get('bonus-entries')
  listEntries(
    @CurrentUser() user: AuthUser,
    @Query('salesId') salesId?: string,
    @Query('status') status?: BonusEntryStatus,
    @Query('period') period?: string,
  ) {
    const effectiveSalesId = user.role === UserRole.SALES ? user.sub : salesId;
    return this.svc.listEntries({ salesId: effectiveSalesId, status, period });
  }

  // CSV export mirrors the list read permission. ADMIN-only — this is the
  // admin compensation export; SALES self-view (Batch 4) is out of scope.
  @Roles(UserRole.ADMIN)
  @Permissions('bonus:entries:read')
  @Get('bonus-entries/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="bonus-entries.csv"')
  entriesCsv(
    @Query('salesId') salesId?: string,
    @Query('status') status?: BonusEntryStatus,
    @Query('period') period?: string,
  ) {
    return this.svc.entriesCsv({ salesId, status, period });
  }

  // Strict: approval recognises the bonus as payable. Segregation of duties
  // — separate the admin who creates entries from the admin who approves.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('bonus:entries:approve')
  @Post('bonus-entries/:id/approve')
  approveEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setEntryStatus(id, { status: BonusEntryStatus.APPROVED });
  }

  // Strict: stamps paidAt — the persisted record of payment.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('bonus:entries:pay')
  @Post('bonus-entries/:id/pay')
  payEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setEntryStatus(id, { status: BonusEntryStatus.PAID });
  }

  // Revert-only path. DTO is narrowed to accept ONLY status: PENDING. The
  // global ValidationPipe rejects any other value with 400.
  @Roles(UserRole.ADMIN)
  @Permissions('bonus:entries:approve')
  @Patch('bonus-entries/:id')
  setEntryStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEntryStatusDto) {
    return this.svc.setEntryStatus(id, dto);
  }

  // Targets
  @Roles(UserRole.ADMIN)
  @Permissions('targets:manage')
  @Post('sales-targets')
  upsertTarget(@Body() dto: CreateTargetDto) {
    return this.svc.upsertTarget(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Permissions('targets:read')
  @Get('sales-targets')
  listTargets(@CurrentUser() user: AuthUser, @Query('salesId') salesId?: string) {
    const effective = user.role === UserRole.SALES ? user.sub : salesId;
    return this.svc.listTargets(effective);
  }
}

@Module({
  controllers: [BonusController],
  providers: [BonusService],
})
export class BonusModule {}
