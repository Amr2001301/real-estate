import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  Prisma,
  InstallmentStatus,
  UserRole,
  DownPaymentType,
  InstallmentFrequency,
  StartDateRule,
  PlanTemplateStatus,
  PlanPaymentType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';

// ─── Existing contract-based plan DTOs ────────────────────────────────────────

class CreatePlanDto {
  @IsUUID() contractId!: string;
  @IsInt() @Min(1) @Max(360) totalMonths!: number;
  @IsNumber() @IsPositive() monthlyAmount!: number;
  @IsDateString() startsAt!: string;
}

// ─── Template DTOs ─────────────────────────────────────────────────────────────

class CreatePlanTemplateDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsUUID() projectId!: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsNumber() @IsPositive() totalPrice!: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsNumber() @Min(0) reservationAmount!: number;
  @IsEnum(DownPaymentType) downPaymentType!: DownPaymentType;
  @IsNumber() @IsPositive() downPaymentValue!: number;
  @IsInt() @Min(1) installmentsCount!: number;
  @IsEnum(InstallmentFrequency) frequency!: InstallmentFrequency;
  @IsEnum(StartDateRule) startDateRule!: StartDateRule;
  @IsOptional() @IsDateString() manualStartDate?: string;
  @IsOptional() @IsNumber() @Min(0) finalPaymentAmount?: number;
  @IsOptional() @IsEnum(PlanTemplateStatus) status?: PlanTemplateStatus;
}

class UpdatePlanTemplateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsNumber() @IsPositive() totalPrice?: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsNumber() @Min(0) reservationAmount?: number;
  @IsOptional() @IsEnum(DownPaymentType) downPaymentType?: DownPaymentType;
  @IsOptional() @IsNumber() @IsPositive() downPaymentValue?: number;
  @IsOptional() @IsInt() @Min(1) installmentsCount?: number;
  @IsOptional() @IsEnum(InstallmentFrequency) frequency?: InstallmentFrequency;
  @IsOptional() @IsEnum(StartDateRule) startDateRule?: StartDateRule;
  @IsOptional() @IsDateString() manualStartDate?: string;
  @IsOptional() @IsNumber() @Min(0) finalPaymentAmount?: number;
  @IsOptional() @IsEnum(PlanTemplateStatus) status?: PlanTemplateStatus;
}

// ─── Existing contract-based plan service ─────────────────────────────────────

@Injectable()
class InstallmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPlan(dto: CreatePlanDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
      include: { installmentPlan: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.installmentPlan) throw new ConflictException('Plan already exists');

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Invalid startsAt');

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.installmentPlan.create({
        data: {
          contractId: dto.contractId,
          totalMonths: dto.totalMonths,
          monthlyAmount: new Prisma.Decimal(dto.monthlyAmount),
          startsAt,
        },
      });
      const rows: Prisma.InstallmentCreateManyInput[] = [];
      for (let i = 0; i < dto.totalMonths; i++) {
        const due = new Date(startsAt);
        due.setMonth(due.getMonth() + i);
        rows.push({
          planId: plan.id,
          dueDate: due,
          amount: new Prisma.Decimal(dto.monthlyAmount),
        });
      }
      await tx.installment.createMany({ data: rows });
      return tx.installmentPlan.findUnique({
        where: { id: plan.id },
        include: { installments: { orderBy: { dueDate: 'asc' } } },
      });
    });
  }

  async findByContract(contractId: string) {
    return this.prisma.installmentPlan.findUnique({
      where: { contractId },
      include: { installments: { orderBy: { dueDate: 'asc' } } },
    });
  }

  async markOverdue() {
    const result = await this.prisma.installment.updateMany({
      where: {
        status: InstallmentStatus.PENDING,
        dueDate: { lt: new Date() },
      },
      data: { status: InstallmentStatus.OVERDUE },
    });
    return { marked: result.count };
  }
}

// ─── Template service ──────────────────────────────────────────────────────────

function computeDownPaymentAmount(
  netPrice: number,
  type: DownPaymentType,
  value: number,
): number {
  return type === DownPaymentType.PERCENTAGE ? (netPrice * value) / 100 : value;
}

function buildScheduleItems(
  dto: CreatePlanTemplateDto | UpdatePlanTemplateDto,
  totalPrice: number,
  discountAmount: number,
): Prisma.PlanTemplateScheduleItemCreateManyInput[] {
  const tp = totalPrice;
  const disc = discountAmount;
  const netPrice = tp - disc;
  const reservation = dto.reservationAmount ?? 0;
  const dpType = dto.downPaymentType ?? DownPaymentType.FIXED;
  const dpValue = dto.downPaymentValue ?? 0;
  const dpAmount = computeDownPaymentAmount(netPrice, dpType, dpValue);
  const finalPayment = dto.finalPaymentAmount ?? 0;
  const installmentsCount = dto.installmentsCount ?? 1;
  const remaining = netPrice - reservation - dpAmount - finalPayment;
  const perInstallment = installmentsCount > 0 ? remaining / installmentsCount : 0;

  const items: Omit<Prisma.PlanTemplateScheduleItemCreateManyInput, 'planId'>[] = [];
  let paymentNumber = 1;
  let remainingBalance = netPrice;

  if (reservation > 0) {
    remainingBalance -= reservation;
    items.push({
      paymentNumber: paymentNumber++,
      paymentType: PlanPaymentType.RESERVATION,
      dueDate: null,
      amount: new Prisma.Decimal(reservation),
      remainingBalance: new Prisma.Decimal(remainingBalance),
    });
  }

  remainingBalance -= dpAmount;
  items.push({
    paymentNumber: paymentNumber++,
    paymentType: PlanPaymentType.DOWN_PAYMENT,
    dueDate: null,
    amount: new Prisma.Decimal(dpAmount),
    remainingBalance: new Prisma.Decimal(remainingBalance),
  });

  const startDate =
    dto.startDateRule === StartDateRule.MANUAL && dto.manualStartDate
      ? new Date(dto.manualStartDate)
      : null;

  const frequencyMonths: Record<InstallmentFrequency, number> = {
    MONTHLY: 1,
    QUARTERLY: 3,
    SEMI_ANNUAL: 6,
    YEARLY: 12,
  };
  const monthStep = frequencyMonths[dto.frequency ?? InstallmentFrequency.MONTHLY];

  for (let i = 0; i < installmentsCount; i++) {
    let dueDate: Date | null = null;
    if (startDate) {
      dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i * monthStep);
    }
    remainingBalance -= perInstallment;
    items.push({
      paymentNumber: paymentNumber++,
      paymentType: PlanPaymentType.INSTALLMENT,
      dueDate,
      amount: new Prisma.Decimal(perInstallment),
      remainingBalance: new Prisma.Decimal(remainingBalance),
    });
  }

  if (finalPayment > 0) {
    remainingBalance -= finalPayment;
    items.push({
      paymentNumber: paymentNumber++,
      paymentType: PlanPaymentType.FINAL_PAYMENT,
      dueDate: null,
      amount: new Prisma.Decimal(finalPayment),
      remainingBalance: new Prisma.Decimal(remainingBalance),
    });
  }

  return items as Prisma.PlanTemplateScheduleItemCreateManyInput[];
}

@Injectable()
class PlanTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: {
    page: number;
    pageSize: number;
    q?: string;
    projectId?: string;
    status?: PlanTemplateStatus;
    role: UserRole;
  }) {
    const { page, pageSize, q, projectId, status, role } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.InstallmentPlanTemplateWhereInput = {};

    // SALES can only see ACTIVE plans
    if (role === UserRole.SALES) {
      where.status = PlanTemplateStatus.ACTIVE;
    } else if (status) {
      where.status = status;
    }

    if (projectId) where.projectId = projectId;

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { project: { name: { path: ['ar'], string_contains: q } } },
        { project: { name: { path: ['en'], string_contains: q } } },
        { unit: { code: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.installmentPlanTemplate.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, name: true } },
          unit: { select: { id: true, code: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.installmentPlanTemplate.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async stats() {
    const [total, active, draft, inactive] = await Promise.all([
      this.prisma.installmentPlanTemplate.count(),
      this.prisma.installmentPlanTemplate.count({ where: { status: PlanTemplateStatus.ACTIVE } }),
      this.prisma.installmentPlanTemplate.count({ where: { status: PlanTemplateStatus.DRAFT } }),
      this.prisma.installmentPlanTemplate.count({ where: { status: PlanTemplateStatus.INACTIVE } }),
    ]);
    return { total, active, draft, inactive };
  }

  async findOne(id: string) {
    const plan = await this.prisma.installmentPlanTemplate.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        unit: { select: { id: true, code: true, type: true } },
        createdBy: { select: { id: true, fullName: true } },
        scheduleItems: { orderBy: { paymentNumber: 'asc' } },
      },
    });
    if (!plan) throw new NotFoundException('Installment plan template not found');
    return plan;
  }

  async create(dto: CreatePlanTemplateDto, userId: string) {
    const totalPrice = dto.totalPrice;
    const discountAmount = dto.discountAmount ?? 0;
    const netPrice = totalPrice - discountAmount;
    const dpAmount = computeDownPaymentAmount(
      netPrice,
      dto.downPaymentType,
      dto.downPaymentValue,
    );

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.installmentPlanTemplate.create({
        data: {
          name: dto.name,
          description: dto.description,
          projectId: dto.projectId,
          unitId: dto.unitId ?? null,
          totalPrice: new Prisma.Decimal(totalPrice),
          discountAmount: new Prisma.Decimal(discountAmount),
          netPrice: new Prisma.Decimal(netPrice),
          reservationAmount: new Prisma.Decimal(dto.reservationAmount ?? 0),
          downPaymentType: dto.downPaymentType,
          downPaymentValue: new Prisma.Decimal(dto.downPaymentValue),
          downPaymentAmount: new Prisma.Decimal(dpAmount),
          installmentsCount: dto.installmentsCount,
          frequency: dto.frequency,
          startDateRule: dto.startDateRule,
          manualStartDate: dto.manualStartDate ? new Date(dto.manualStartDate) : null,
          finalPaymentAmount: dto.finalPaymentAmount
            ? new Prisma.Decimal(dto.finalPaymentAmount)
            : null,
          status: dto.status ?? PlanTemplateStatus.DRAFT,
          createdById: userId,
        },
      });

      const scheduleRows = buildScheduleItems(dto, totalPrice, discountAmount).map((item) => ({
        ...item,
        planId: plan.id,
      }));
      await tx.planTemplateScheduleItem.createMany({ data: scheduleRows });

      return tx.installmentPlanTemplate.findUnique({
        where: { id: plan.id },
        include: {
          project: { select: { id: true, name: true } },
          unit: { select: { id: true, code: true } },
          scheduleItems: { orderBy: { paymentNumber: 'asc' } },
        },
      });
    });
  }

  async update(id: string, dto: UpdatePlanTemplateDto) {
    const existing = await this.findOne(id);

    const totalPrice = dto.totalPrice ?? Number(existing.totalPrice);
    const discountAmount = dto.discountAmount ?? Number(existing.discountAmount);
    const netPrice = totalPrice - discountAmount;
    const dpType = dto.downPaymentType ?? existing.downPaymentType;
    const dpValue = dto.downPaymentValue ?? Number(existing.downPaymentValue);
    const dpAmount = computeDownPaymentAmount(netPrice, dpType, dpValue);

    const merged: CreatePlanTemplateDto = {
      name: dto.name ?? existing.name,
      description: dto.description ?? existing.description ?? undefined,
      projectId: dto.projectId ?? existing.projectId,
      unitId: dto.unitId ?? existing.unitId ?? undefined,
      totalPrice,
      discountAmount,
      reservationAmount: dto.reservationAmount ?? Number(existing.reservationAmount),
      downPaymentType: dpType,
      downPaymentValue: dpValue,
      installmentsCount: dto.installmentsCount ?? existing.installmentsCount,
      frequency: dto.frequency ?? existing.frequency,
      startDateRule: dto.startDateRule ?? existing.startDateRule,
      manualStartDate:
        dto.manualStartDate ??
        (existing.manualStartDate ? existing.manualStartDate.toISOString() : undefined),
      finalPaymentAmount:
        dto.finalPaymentAmount ?? (existing.finalPaymentAmount ? Number(existing.finalPaymentAmount) : undefined),
      status: dto.status ?? existing.status,
    };

    return this.prisma.$transaction(async (tx) => {
      await tx.planTemplateScheduleItem.deleteMany({ where: { planId: id } });

      const plan = await tx.installmentPlanTemplate.update({
        where: { id },
        data: {
          name: merged.name,
          description: merged.description ?? null,
          projectId: merged.projectId,
          unitId: merged.unitId ?? null,
          totalPrice: new Prisma.Decimal(totalPrice),
          discountAmount: new Prisma.Decimal(discountAmount),
          netPrice: new Prisma.Decimal(netPrice),
          reservationAmount: new Prisma.Decimal(merged.reservationAmount ?? 0),
          downPaymentType: dpType,
          downPaymentValue: new Prisma.Decimal(dpValue),
          downPaymentAmount: new Prisma.Decimal(dpAmount),
          installmentsCount: merged.installmentsCount,
          frequency: merged.frequency,
          startDateRule: merged.startDateRule,
          manualStartDate: merged.manualStartDate ? new Date(merged.manualStartDate) : null,
          finalPaymentAmount: merged.finalPaymentAmount
            ? new Prisma.Decimal(merged.finalPaymentAmount)
            : null,
          status: merged.status ?? PlanTemplateStatus.DRAFT,
        },
      });

      const scheduleRows = buildScheduleItems(merged, totalPrice, discountAmount).map((item) => ({
        ...item,
        planId: plan.id,
      }));
      await tx.planTemplateScheduleItem.createMany({ data: scheduleRows });

      return tx.installmentPlanTemplate.findUnique({
        where: { id: plan.id },
        include: {
          project: { select: { id: true, name: true } },
          unit: { select: { id: true, code: true } },
          scheduleItems: { orderBy: { paymentNumber: 'asc' } },
        },
      });
    });
  }

  async delete(id: string) {
    const plan = await this.findOne(id);
    if (plan.status !== PlanTemplateStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT plans can be deleted');
    }
    await this.prisma.installmentPlanTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  async setStatus(id: string, status: PlanTemplateStatus) {
    await this.findOne(id);
    return this.prisma.installmentPlanTemplate.update({
      where: { id },
      data: { status },
    });
  }
}

// ─── Existing contract-based cron ─────────────────────────────────────────────

@Injectable()
class InstallmentsCron {
  constructor(private readonly svc: InstallmentsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async daily() {
    await this.svc.markOverdue();
  }
}

// ─── Existing contract-based controller ───────────────────────────────────────

@ApiTags('installments')
@Controller()
class InstallmentsController {
  constructor(private readonly svc: InstallmentsService) {}

  @Roles(UserRole.ADMIN)
  @Post('installment-plans')
  create(@Body() dto: CreatePlanDto) {
    return this.svc.createPlan(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('contracts/:contractId/installment-plan')
  byContract(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.svc.findByContract(contractId);
  }
}

// ─── Template controller ───────────────────────────────────────────────────────

@ApiTags('installment-plan-templates')
@Controller('installment-plan-templates')
class PlanTemplatesController {
  constructor(private readonly svc: PlanTemplatesService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get()
  list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Req() req?: any,
  ) {
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      q,
      projectId,
      status: status as PlanTemplateStatus | undefined,
      role: req?.user?.role ?? UserRole.SALES,
    });
  }

  @Roles(UserRole.ADMIN)
  @Get('stats')
  stats() {
    return this.svc.stats();
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreatePlanTemplateDto, @Req() req: any) {
    return this.svc.create(dto, req.user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanTemplateDto) {
    return this.svc.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.delete(id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setStatus(id, PlanTemplateStatus.ACTIVE);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setStatus(id, PlanTemplateStatus.INACTIVE);
  }
}

// ─── Module ───────────────────────────────────────────────────────────────────

@Module({
  controllers: [InstallmentsController, PlanTemplatesController],
  providers: [InstallmentsService, InstallmentsCron, PlanTemplatesService],
  exports: [InstallmentsService, PlanTemplatesService],
})
export class InstallmentsModule {}
