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
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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
import {
  NotificationsModule,
  NotificationsService,
} from '../notifications/notifications.module';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { computeDurationOption } from './duration-calc';

// ─── Existing contract-based plan DTOs ────────────────────────────────────────

class CreatePlanDto {
  @IsUUID() contractId!: string;
  @IsInt() @Min(1) @Max(360) totalMonths!: number;
  @IsNumber() @IsPositive() monthlyAmount!: number;
  @IsDateString() startsAt!: string;
}

// ─── Template DTOs ─────────────────────────────────────────────────────────────

class DurationOptionDto {
  @IsInt() @Min(1) durationMonths!: number;
  @IsNumber() @Min(0) increasePercentage!: number;
}

class CreatePlanTemplateDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsUUID() projectId!: string;
  @IsUUID() unitId!: string;
  @IsNumber() @IsPositive() totalPrice!: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsNumber() @Min(0) reservationAmount!: number;
  @IsEnum(DownPaymentType) downPaymentType!: DownPaymentType;
  @IsNumber() @IsPositive() downPaymentValue!: number;
  // installmentsCount + frequency are legacy single-duration fields.
  // New templates should send durationOptions instead.
  @IsOptional() @IsInt() @Min(1) installmentsCount?: number;
  @IsOptional() @IsEnum(InstallmentFrequency) frequency?: InstallmentFrequency;
  @IsEnum(StartDateRule) startDateRule!: StartDateRule;
  @IsOptional() @IsDateString() manualStartDate?: string;
  @IsOptional() @IsNumber() @Min(0) finalPaymentAmount?: number;
  @IsOptional() @IsEnum(PlanTemplateStatus) status?: PlanTemplateStatus;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DurationOptionDto)
  durationOptions?: DurationOptionDto[];
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
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DurationOptionDto)
  durationOptions?: DurationOptionDto[];
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

/**
 * Validate the duration-options array and return rows ready for createMany.
 * - No duplicate durationMonths
 * - All durationMonths > 0, increasePercentage >= 0
 * - Caller must also enforce reservationAmount + downPaymentAmount <= netPrice
 */
function buildDurationOptionRows(
  options: DurationOptionDto[] | undefined,
): Omit<Prisma.InstallmentPlanDurationOptionCreateManyInput, 'planId'>[] {
  if (!options || options.length === 0) return [];
  const seen = new Set<number>();
  return options.map((opt, idx) => {
    if (!Number.isInteger(opt.durationMonths) || opt.durationMonths <= 0) {
      throw new BadRequestException(
        `مدة التقسيط (${opt.durationMonths}) يجب أن تكون عدداً صحيحاً موجباً`,
      );
    }
    if (opt.increasePercentage < 0) {
      throw new BadRequestException(
        `نسبة الزيادة (${opt.increasePercentage}) يجب أن تكون صفراً أو أكثر`,
      );
    }
    if (seen.has(opt.durationMonths)) {
      throw new BadRequestException(
        `مدة التقسيط ${opt.durationMonths} مكررة في نفس الخطة`,
      );
    }
    seen.add(opt.durationMonths);
    return {
      durationMonths: opt.durationMonths,
      increasePercentage: new Prisma.Decimal(opt.increasePercentage),
      order: idx,
    };
  });
}

/**
 * Annotate each persisted duration option with its calculated breakdown.
 */
function enrichDurationOptions(
  options: { id: string; durationMonths: number; increasePercentage: Prisma.Decimal; order: number }[],
  context: { netPrice: Prisma.Decimal | number; reservationAmount: Prisma.Decimal | number; downPaymentAmount: Prisma.Decimal | number },
) {
  const netPrice = Number(context.netPrice);
  const reservationAmount = Number(context.reservationAmount);
  const downPaymentAmount = Number(context.downPaymentAmount);
  return options.map((o) => ({
    id: o.id,
    durationMonths: o.durationMonths,
    increasePercentage: o.increasePercentage.toString(),
    order: o.order,
    calculated: computeDurationOption({
      netPrice,
      reservationAmount,
      downPaymentAmount,
      durationMonths: o.durationMonths,
      increasePercentage: Number(o.increasePercentage),
    }),
  }));
}

@Injectable()
class PlanTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
          durationOptions: {
            select: { id: true, durationMonths: true, increasePercentage: true, order: true },
            orderBy: { order: 'asc' },
          },
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
        unit: { select: { id: true, code: true, type: true, price: true } },
        createdBy: { select: { id: true, fullName: true } },
        scheduleItems: { orderBy: { paymentNumber: 'asc' } },
        durationOptions: { orderBy: { order: 'asc' } },
      },
    });
    if (!plan) throw new NotFoundException('Installment plan template not found');
    return {
      ...plan,
      durationOptions: enrichDurationOptions(plan.durationOptions, {
        netPrice: plan.netPrice,
        reservationAmount: plan.reservationAmount,
        downPaymentAmount: plan.downPaymentAmount,
      }),
    };
  }

  private async validateUnit(unitId: string, projectId: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, building: { select: { phase: { select: { projectId: true } } } } },
    });
    if (!unit) throw new NotFoundException('الوحدة غير موجودة');
    if (unit.building.phase.projectId !== projectId)
      throw new BadRequestException('الوحدة لا تنتمي إلى المشروع المحدد');
  }

  async create(dto: CreatePlanTemplateDto, userId: string) {
    await this.validateUnit(dto.unitId, dto.projectId);

    if (dto.unitId) {
      const duplicate = await this.prisma.installmentPlanTemplate.findFirst({
        where: { unitId: dto.unitId },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('هذه الوحدة لديها خطة تقسيط بالفعل');
    }

    const totalPrice = dto.totalPrice;
    const discountAmount = dto.discountAmount ?? 0;
    const netPrice = totalPrice - discountAmount;
    const dpAmount = computeDownPaymentAmount(
      netPrice,
      dto.downPaymentType,
      dto.downPaymentValue,
    );

    // Business rule (shared with legacy and new model):
    // reservationAmount + downPaymentAmount cannot exceed netPrice
    const reservation = dto.reservationAmount ?? 0;
    if (reservation + dpAmount > netPrice) {
      throw new BadRequestException(
        'مبلغ الحجز + الدفعة الأولى يتجاوزان صافي السعر',
      );
    }

    const useDurationOptions = !!dto.durationOptions && dto.durationOptions.length > 0;
    const durationOptionRows = buildDurationOptionRows(dto.durationOptions);

    // Duration-option templates are used by Reservations to derive bookingAmount.
    // The reservation flow rejects plans with reservationAmount <= 0, so block this
    // earlier — at the source — with a clear admin-facing message.
    if (useDurationOptions && reservation <= 0) {
      throw new BadRequestException(
        'دفعة الحجز يجب أن تكون أكبر من صفر للخطط التي تستخدم خيارات المدة',
      );
    }

    const createdId = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.installmentPlanTemplate.create({
        data: {
          name: dto.name,
          description: dto.description,
          projectId: dto.projectId,
          unitId: dto.unitId,
          totalPrice: new Prisma.Decimal(totalPrice),
          discountAmount: new Prisma.Decimal(discountAmount),
          netPrice: new Prisma.Decimal(netPrice),
          reservationAmount: new Prisma.Decimal(reservation),
          downPaymentType: dto.downPaymentType,
          downPaymentValue: new Prisma.Decimal(dto.downPaymentValue),
          downPaymentAmount: new Prisma.Decimal(dpAmount),
          installmentsCount: useDurationOptions ? null : dto.installmentsCount,
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

      if (useDurationOptions) {
        await tx.installmentPlanDurationOption.createMany({
          data: durationOptionRows.map((r) => ({ ...r, planId: plan.id })),
        });
      } else if (dto.installmentsCount) {
        // Legacy single-duration template: keep generating PlanTemplateScheduleItem rows
        const scheduleRows = buildScheduleItems(dto, totalPrice, discountAmount).map((item) => ({
          ...item,
          planId: plan.id,
        }));
        await tx.planTemplateScheduleItem.createMany({ data: scheduleRows });
      }

      return plan.id;
    });

    // findOne must run AFTER the transaction commits — running it inside the
    // $transaction callback uses `this.prisma` (a different connection) which
    // cannot see the not-yet-committed writes, and would falsely 404.
    const created = await this.findOne(createdId);

    // P4 — event: a new ACTIVE plan template is now visible to sales and
    // sales managers. Only fire when the plan is actually ACTIVE — DRAFT
    // plans are admin-only WIP and shouldn't ping sales. Project name is
    // resolved from the related project; failure to resolve doesn't block.
    if (created.status === PlanTemplateStatus.ACTIVE) {
      await this.notifyPlanCreated(createdId);
    }

    return created;
  }

  /** Resolve project name + send `installment_plan_created` to all SALES
   *  and SALES_MANAGER users. Errors are silently swallowed by the helper. */
  private async notifyPlanCreated(planId: string): Promise<void> {
    let projectName = '';
    try {
      const plan = await this.prisma.installmentPlanTemplate.findUnique({
        where: { id: planId },
        select: { project: { select: { name: true } } },
      });
      const n = plan?.project?.name as { ar?: string; en?: string } | undefined;
      projectName = n?.ar || n?.en || '';
    } catch {
      // Best-effort context; missing project name just renders as empty.
    }
    await this.notifications.sendToRoles(
      [UserRole.SALES, UserRole.SALES_MANAGER],
      'installment_plan_created',
      { planTemplateId: planId, projectName },
    );
  }

  async update(id: string, dto: UpdatePlanTemplateDto) {
    const existing = await this.findOne(id);

    const resolvedProjectId = dto.projectId ?? existing.projectId;
    const resolvedUnitId = dto.unitId ?? existing.unitId;
    if (!resolvedUnitId) throw new BadRequestException('يرجى اختيار الوحدة');
    if (dto.unitId || dto.projectId) {
      await this.validateUnit(resolvedUnitId, resolvedProjectId);
    }

    const totalPrice = dto.totalPrice ?? Number(existing.totalPrice);
    const discountAmount = dto.discountAmount ?? Number(existing.discountAmount);
    const netPrice = totalPrice - discountAmount;
    const dpType = dto.downPaymentType ?? existing.downPaymentType;
    const dpValue = dto.downPaymentValue ?? Number(existing.downPaymentValue);
    const dpAmount = computeDownPaymentAmount(netPrice, dpType, dpValue);

    const merged: CreatePlanTemplateDto = {
      name: dto.name ?? existing.name,
      description: dto.description ?? existing.description ?? undefined,
      projectId: resolvedProjectId,
      unitId: resolvedUnitId,
      totalPrice,
      discountAmount,
      reservationAmount: dto.reservationAmount ?? Number(existing.reservationAmount),
      downPaymentType: dpType,
      downPaymentValue: dpValue,
      installmentsCount: dto.installmentsCount ?? existing.installmentsCount ?? undefined,
      frequency: dto.frequency ?? existing.frequency,
      startDateRule: dto.startDateRule ?? existing.startDateRule,
      manualStartDate:
        dto.manualStartDate ??
        (existing.manualStartDate ? existing.manualStartDate.toISOString() : undefined),
      finalPaymentAmount:
        dto.finalPaymentAmount ?? (existing.finalPaymentAmount ? Number(existing.finalPaymentAmount) : undefined),
      status: dto.status ?? existing.status,
    };

    const reservation = merged.reservationAmount ?? 0;
    if (reservation + dpAmount > netPrice) {
      throw new BadRequestException(
        'مبلغ الحجز + الدفعة الأولى يتجاوزان صافي السعر',
      );
    }

    // Resolve duration options: explicit payload replaces the set; if not provided, keep existing.
    const explicitDurationOptions = dto.durationOptions !== undefined;
    const durationOptionRows = explicitDurationOptions
      ? buildDurationOptionRows(dto.durationOptions)
      : [];
    const willUseDurationOptions = explicitDurationOptions
      ? durationOptionRows.length > 0
      : existing.durationOptions.length > 0;

    // Same rule as create(): duration-option templates must have reservationAmount > 0
    if (willUseDurationOptions && reservation <= 0) {
      throw new BadRequestException(
        'دفعة الحجز يجب أن تكون أكبر من صفر للخطط التي تستخدم خيارات المدة',
      );
    }

    const updatedId = await this.prisma.$transaction(async (tx) => {
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
          reservationAmount: new Prisma.Decimal(reservation),
          downPaymentType: dpType,
          downPaymentValue: new Prisma.Decimal(dpValue),
          downPaymentAmount: new Prisma.Decimal(dpAmount),
          installmentsCount: willUseDurationOptions ? null : merged.installmentsCount,
          frequency: merged.frequency,
          startDateRule: merged.startDateRule,
          manualStartDate: merged.manualStartDate ? new Date(merged.manualStartDate) : null,
          finalPaymentAmount: merged.finalPaymentAmount
            ? new Prisma.Decimal(merged.finalPaymentAmount)
            : null,
          status: merged.status ?? PlanTemplateStatus.DRAFT,
        },
      });

      // Duration options: replace the set if explicitly provided
      if (explicitDurationOptions) {
        await tx.installmentPlanDurationOption.deleteMany({ where: { planId: id } });
        if (durationOptionRows.length > 0) {
          await tx.installmentPlanDurationOption.createMany({
            data: durationOptionRows.map((r) => ({ ...r, planId: id })),
          });
        }
      }

      // Legacy schedule items: regenerate only when we are NOT using duration options
      await tx.planTemplateScheduleItem.deleteMany({ where: { planId: id } });
      if (!willUseDurationOptions && merged.installmentsCount) {
        const scheduleRows = buildScheduleItems(merged, totalPrice, discountAmount).map((item) => ({
          ...item,
          planId: plan.id,
        }));
        await tx.planTemplateScheduleItem.createMany({ data: scheduleRows });
      }

      return plan.id;
    });

    // Same reasoning as create(): findOne must run after the transaction commits.
    return this.findOne(updatedId);
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
    const previous = await this.findOne(id);
    const updated = await this.prisma.installmentPlanTemplate.update({
      where: { id },
      data: { status },
    });
    // P4 — fire installment_plan_created on the DRAFT/INACTIVE → ACTIVE edge
    // so re-activating a plan after a content review still pings sales.
    if (status === PlanTemplateStatus.ACTIVE && previous.status !== PlanTemplateStatus.ACTIVE) {
      await this.notifyPlanCreated(id);
    }
    return updated;
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

// ─── P11 — Customer-facing installments controller ───────────────────────
// GET /v1/me/installments returns the signed-in customer's full installment
// schedule across their contracts. Scoped purely by Installment.plan.
// contract.customerId so cross-customer access is impossible. Response shape
// intentionally OMITS any file URLs — proof PDFs/receipts are reached via
// the customer signed-download endpoint just like /me/documents.
class MeInstallmentsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
  @IsOptional() @IsUUID() contractId?: string;
  @IsOptional() @IsEnum(InstallmentStatus) status?: InstallmentStatus;
}

@Injectable()
class MeInstallmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(
    userId: string,
    opts: { page: number; pageSize: number; contractId?: string; status?: InstallmentStatus },
  ) {
    const where: Prisma.InstallmentWhereInput = {
      plan: { contract: { customerId: userId } },
      ...(opts.contractId ? { plan: { contract: { customerId: userId, id: opts.contractId } } } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.installment.findMany({
        where,
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          dueDate: true,
          amount: true,
          status: true,
          paidAt: true,
          type: true,
          plan: {
            select: {
              contract: {
                select: {
                  id: true,
                  contractNumber: true,
                  unit: {
                    select: {
                      id: true,
                      code: true,
                      type: true,
                      building: {
                        select: {
                          phase: {
                            select: { project: { select: { id: true, name: true } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.installment.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: opts.page,
        pageSize: opts.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
      },
    };
  }
}

@ApiTags('me-installments')
@Controller('me/installments')
class MeInstallmentsController {
  constructor(private readonly svc: MeInstallmentsService) {}

  @Roles(UserRole.CUSTOMER)
  @Get()
  list(@Req() req: { user: { sub: string } }, @Query() q: MeInstallmentsQueryDto) {
    return this.svc.listForUser(req.user.sub, {
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 50,
      contractId: q.contractId,
      status: q.status,
    });
  }
}

// ─── Existing contract-based controller ───────────────────────────────────────

@ApiTags('installments')
@Controller()
class InstallmentsController {
  constructor(private readonly svc: InstallmentsService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('installments:manage')
  @Post('installment-plans')
  create(@Body() dto: CreatePlanDto) {
    return this.svc.createPlan(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('installments:read')
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

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('installments:read')
  @Get()
  list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Req() req?: { user?: { role?: UserRole } },
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
  @Permissions('installments:read')
  @Get('stats')
  stats() {
    return this.svc.stats();
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('installments:read')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('installments:manage')
  @Post()
  create(@Body() dto: CreatePlanTemplateDto, @Req() req: { user: { sub: string } }) {
    return this.svc.create(dto, req.user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('installments:manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanTemplateDto) {
    return this.svc.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('installments:manage')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.delete(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('installments:activate')
  @Post(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setStatus(id, PlanTemplateStatus.ACTIVE);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('installments:activate')
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setStatus(id, PlanTemplateStatus.INACTIVE);
  }
}

// ─── Module ───────────────────────────────────────────────────────────────────

@Module({
  imports: [NotificationsModule],
  controllers: [InstallmentsController, PlanTemplatesController, MeInstallmentsController],
  providers: [
    InstallmentsService,
    InstallmentsCron,
    PlanTemplatesService,
    MeInstallmentsService,
  ],
  exports: [InstallmentsService, PlanTemplatesService],
})
export class InstallmentsModule {}
