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
import { Roles } from '../../common/decorators/roles.decorator';
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

class UpdateEntryStatusDto {
  @IsEnum(BonusEntryStatus) status!: BonusEntryStatus;
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
  @Get('bonus-rules')
  listRules() {
    return this.svc.listRules();
  }

  @Roles(UserRole.ADMIN)
  @Post('bonus-rules')
  createRule(@Body() dto: CreateRuleDto) {
    return this.svc.createRule(dto);
  }

  // Entries
  @Roles(UserRole.ADMIN)
  @Post('bonus-entries')
  createEntry(@Body() dto: CreateEntryDto) {
    return this.svc.createEntry(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
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

  @Roles(UserRole.ADMIN)
  @Patch('bonus-entries/:id')
  setEntryStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEntryStatusDto) {
    return this.svc.setEntryStatus(id, dto);
  }

  // Targets
  @Roles(UserRole.ADMIN)
  @Post('sales-targets')
  upsertTarget(@Body() dto: CreateTargetDto) {
    return this.svc.upsertTarget(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
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
