import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  DepositType,
  LeadStage,
  NotificationChannel,
  PlanPaymentType,
  PlanTemplateStatus,
  Prisma,
  ReservationActivityType,
  ReservationBookingPaymentStatus,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { matchOrCreateLeadForClient } from '../crm/crm-lead-matching';
import { computeDurationOption } from '../installments/duration-calc';
import { BrokerCommissionsModule } from '../broker-commissions/broker-commissions.module';
import { BrokerCommissionsService } from '../broker-commissions/broker-commissions.service';

class CreateReservationDto {
  @IsUUID() unitId!: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() salesId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsInt() @Min(1) @Max(720) expiresInHours?: number;
  // Plan linkage: when provided, server copies plan.reservationAmount → bookingAmount.
  // bookingAmount / bookingPaymentStatus / bookingPaidAt are intentionally NOT accepted
  // on create — they are derived from the plan and the confirm-payment flow.
  @IsOptional() @IsUUID() installmentPlanTemplateId?: string;
  // Required when the linked template has duration options; ignored otherwise.
  @IsOptional() @IsUUID() installmentPlanDurationOptionId?: string;
  @IsOptional() @IsString() bookingNotes?: string;
}

class UpdateReservationStatusDto {
  @IsEnum(ReservationStatus) status!: ReservationStatus;
  @IsOptional() @IsString() reason?: string;
}

class UpdateReservationDto {
  @IsOptional() @IsUUID() salesId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(720) expiresInHours?: number;
  @IsOptional() @IsString() notes?: string;
  // Booking amount fields — editable by Admin on PENDING or APPROVED reservations
  @IsOptional() @IsUUID() installmentPlanTemplateId?: string | null;
  @IsOptional() @IsNumber() @Min(0) bookingAmount?: number;
  @IsOptional() @IsEnum(ReservationBookingPaymentStatus)
  bookingPaymentStatus?: ReservationBookingPaymentStatus;
  @IsOptional() @IsDateString() bookingPaidAt?: string | null;
  @IsOptional() @IsString() bookingNotes?: string | null;
}

class ConvertReservationDto {
  // Required only when the reservation has selectedDurationMonths.
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() signedAt?: string;
  @IsOptional() @IsString() pdfUrl?: string;
}

class AddNoteDto {
  @IsString() @IsNotEmpty() body!: string;
}

class ConfirmBookingPaymentDto {
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() note?: string;
}

class UnconfirmBookingPaymentDto {
  @IsOptional() @IsEnum(ReservationBookingPaymentStatus)
  newStatus?: ReservationBookingPaymentStatus;
  @IsOptional() @IsString() note?: string;
}

const FULL_INCLUDE = {
  unit: {
    include: {
      building: { include: { phase: { include: { project: true } } } },
    },
  },
  sales: { select: { id: true, fullName: true } },
  lead: { select: { id: true, fullName: true, phone: true, email: true } },
  client: { select: { id: true, fullName: true, phone: true, email: true } },
  installmentPlanTemplate: {
    select: { id: true, name: true, status: true, reservationAmount: true, projectId: true, unitId: true },
  },
  selectedDurationOption: {
    select: { id: true, durationMonths: true, increasePercentage: true },
  },
  contract: { select: { id: true, contractNumber: true } },
  reservationNotes: {
    orderBy: { createdAt: 'desc' as const },
    include: { author: { select: { id: true, fullName: true } } },
  },
  activities: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { id: true, fullName: true } } },
  },
};

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brokerCommissions: BrokerCommissionsService,
  ) {}

  // Public so the broker portal reservations service can reuse the same
  // numbering scheme without duplicating logic. Behavior unchanged.
  async nextReservationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.reservation.count();
    return `RES-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Generate the next contract number by finding the highest existing numeric
   * suffix for the current year, then adding 1.  Using COUNT()+1 is unsafe
   * because deleted rows leave gaps that cause duplicates.
   *
   * Example: CON-2026-0001 deleted, CON-2026-0002 exists → returns CON-2026-0003.
   */
  private async nextContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CON-${year}-`;
    const rows = await this.prisma.contract.findMany({
      where: { contractNumber: { startsWith: prefix } },
      select: { contractNumber: true },
    });
    let maxSeq = 0;
    for (const { contractNumber } of rows) {
      if (contractNumber) {
        const seq = parseInt(contractNumber.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  /**
   * Resolve and validate a booking installment plan. If valid, returns the full plan
   * (including duration options + financial figures needed for snapshot computation).
   *
   * Public so the broker portal reservations service can reuse the same validation
   * (status / unit-match / project-match) without duplicating logic. Behavior unchanged.
   */
  async validateBookingPlan(
    planId: string,
    unitId: string,
    projectId: string,
  ) {
    const plan = await this.prisma.installmentPlanTemplate.findUnique({
      where: { id: planId },
      select: {
        id: true,
        status: true,
        projectId: true,
        unitId: true,
        netPrice: true,
        reservationAmount: true,
        downPaymentAmount: true,
        finalPaymentAmount: true,
        durationOptions: {
          select: { id: true, durationMonths: true, increasePercentage: true },
        },
      },
    });
    if (!plan) {
      throw new BadRequestException('خطة التقسيط غير موجودة');
    }
    if (plan.status !== PlanTemplateStatus.ACTIVE) {
      throw new BadRequestException('خطة التقسيط غير مفعّلة');
    }
    // Plan must match either the exact unit, or be a project-wide plan for the same project
    if (plan.unitId && plan.unitId !== unitId) {
      throw new BadRequestException('خطة التقسيط مرتبطة بوحدة مختلفة');
    }
    if (plan.projectId !== projectId) {
      throw new BadRequestException('خطة التقسيط لا تنتمي إلى مشروع هذه الوحدة');
    }
    return plan;
  }

  async create(actor: AuthUser, dto: CreateReservationDto) {
    if (dto.leadId && dto.clientId) {
      throw new BadRequestException(
        'Cannot provide both leadId and clientId. Choose one owner source.',
      );
    }
    if (!dto.leadId && !dto.clientId) {
      throw new BadRequestException('Either leadId or clientId is required.');
    }

    let effectiveSalesId = actor.sub;

    if (actor.role === UserRole.ADMIN && dto.salesId) {
      const salesUser = await this.prisma.user.findUnique({
        where: { id: dto.salesId },
        select: { id: true, role: true, active: true },
      });
      if (!salesUser) {
        throw new BadRequestException('Sales person not found');
      }
      if (salesUser.role !== UserRole.SALES) {
        throw new BadRequestException('Selected user is not a sales person');
      }
      if (!salesUser.active) {
        throw new BadRequestException('Selected sales person is inactive');
      }
      effectiveSalesId = dto.salesId;
    }

    // XOR ownership: a reservation belongs to EITHER a lead OR a client, never both.
    let resolvedClientId: string | null = null;
    let clientFullName = '';
    let clientPhone: string | null = null;
    let clientEmail: string | null = null;
    if (dto.clientId) {
      const clientUser = await this.prisma.user.findUnique({
        where: { id: dto.clientId },
        select: { id: true, role: true, active: true, fullName: true, phone: true, email: true },
      });
      if (!clientUser) {
        throw new BadRequestException('Client not found');
      }
      if (clientUser.role !== UserRole.CLIENT && clientUser.role !== UserRole.CUSTOMER) {
        throw new BadRequestException('Selected user is not a client or customer');
      }
      if (!clientUser.active) {
        throw new BadRequestException('Selected client is inactive');
      }
      resolvedClientId = clientUser.id;
      clientFullName = clientUser.fullName;
      clientPhone = clientUser.phone;
      clientEmail = clientUser.email;
    } else if (dto.leadId) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: dto.leadId },
        select: { id: true },
      });
      if (!lead) {
        throw new BadRequestException('Lead not found');
      }
      // resolvedClientId stays null — lead-path reservations never carry a clientId
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      include: { building: { include: { phase: { select: { projectId: true } } } } },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new ConflictException('Unit is not available');
    }
    const expiresAt = new Date(Date.now() + (dto.expiresInHours ?? 72) * 3_600_000);
    const reservationNumber = await this.nextReservationNumber();

    // ── Booking amount + selected-duration snapshot ────────────────────────
    // Business rules:
    //  - bookingAmount on create is ALWAYS derived from the linked plan's
    //    reservationAmount. Manual amounts from the client are ignored.
    //  - If the linked plan has duration options, the client MUST also send
    //    installmentPlanDurationOptionId; the duration option must belong to
    //    the same plan. A financial snapshot is then computed and persisted.
    //  - Reservations may still be created without a plan (no booking amount,
    //    no duration snapshot).
    let resolvedPlanId: string | null = null;
    let resolvedBookingAmount: Prisma.Decimal = new Prisma.Decimal(0);
    let selectedDurationOptionId: string | null = null;
    let selectedDurationMonths: number | null = null;
    let selectedIncreasePercentage: Prisma.Decimal | null = null;
    let snapshotDownPaymentAmount: Prisma.Decimal | null = null;
    let snapshotRemainingAmount: Prisma.Decimal | null = null;
    let snapshotFinancedAmount: Prisma.Decimal | null = null;
    let snapshotMonthlyInstallment: Prisma.Decimal | null = null;
    let snapshotTotalPayable: Prisma.Decimal | null = null;
    let snapshotFinalPaymentAmount: Prisma.Decimal | null = null;

    if (dto.installmentPlanTemplateId) {
      const plan = await this.validateBookingPlan(
        dto.installmentPlanTemplateId,
        dto.unitId,
        unit.building.phase.projectId,
      );
      if (plan.reservationAmount.lte(0)) {
        throw new BadRequestException(
          'خطة التقسيط المختارة لا تحدد مبلغ حجز صالحاً',
        );
      }
      resolvedPlanId = plan.id;
      resolvedBookingAmount = plan.reservationAmount;

      if (plan.durationOptions.length > 0) {
        // Plan has duration options → option id is required and must belong here.
        if (!dto.installmentPlanDurationOptionId) {
          throw new BadRequestException(
            'اختر مدة التقسيط من الخطة قبل إنشاء الحجز',
          );
        }
        const option = plan.durationOptions.find(
          (o) => o.id === dto.installmentPlanDurationOptionId,
        );
        if (!option) {
          throw new BadRequestException(
            'مدة التقسيط المختارة لا تنتمي إلى الخطة',
          );
        }
        const calc = computeDurationOption({
          netPrice: Number(plan.netPrice),
          reservationAmount: Number(plan.reservationAmount),
          downPaymentAmount: Number(plan.downPaymentAmount),
          durationMonths: option.durationMonths,
          increasePercentage: Number(option.increasePercentage),
        });
        selectedDurationOptionId = option.id;
        selectedDurationMonths = option.durationMonths;
        selectedIncreasePercentage = option.increasePercentage;
        snapshotDownPaymentAmount = plan.downPaymentAmount;
        snapshotRemainingAmount = new Prisma.Decimal(calc.remainingAmount);
        snapshotFinancedAmount = new Prisma.Decimal(calc.financedAmount);
        snapshotMonthlyInstallment = new Prisma.Decimal(calc.monthlyInstallment);
        snapshotTotalPayable = new Prisma.Decimal(calc.totalPayable);
        snapshotFinalPaymentAmount = plan.finalPaymentAmount ?? null;
      } else if (dto.installmentPlanDurationOptionId) {
        // Plan has no duration options but client sent one → reject.
        throw new BadRequestException(
          'خطة التقسيط المختارة لا تحتوي على خيارات مدة',
        );
      }
    } else if (dto.installmentPlanDurationOptionId) {
      // No plan but option provided → reject as inconsistent input.
      throw new BadRequestException(
        'لا يمكن اختيار مدة تقسيط بدون اختيار خطة التقسيط',
      );
    }

    // Payment status on create is always UNPAID; payment is confirmed later
    // via POST /reservations/:id/booking-payment/confirm.
    const resolvedPaymentStatus = ReservationBookingPaymentStatus.UNPAID;
    const resolvedPaidAt: Date | null = null;

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          reservationNumber,
          unitId: dto.unitId,
          salesId: effectiveSalesId,
          leadId: dto.leadId ?? null,
          clientId: resolvedClientId,
          notes: dto.notes ?? null,
          expiresAt,
          status: ReservationStatus.PENDING,
          installmentPlanTemplateId: resolvedPlanId,
          bookingAmount: resolvedBookingAmount,
          bookingPaymentStatus: resolvedPaymentStatus,
          bookingPaidAt: resolvedPaidAt,
          bookingNotes: dto.bookingNotes ?? null,
          selectedDurationOptionId,
          selectedDurationMonths,
          selectedIncreasePercentage,
          snapshotDownPaymentAmount,
          snapshotRemainingAmount,
          snapshotFinancedAmount,
          snapshotMonthlyInstallment,
          snapshotTotalPayable,
          snapshotFinalPaymentAmount,
        },
      });
      await tx.unit.update({
        where: { id: dto.unitId },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: expiresAt },
      });
      await tx.unitStatusHistory.create({
        data: {
          unitId: dto.unitId,
          oldStatus: UnitStatus.AVAILABLE,
          newStatus: UnitStatus.RESERVED,
          changedById: actor.sub,
          reason: `Reservation ${reservation.reservationNumber}`,
        },
      });
      await tx.reservationActivity.create({
        data: {
          reservationId: reservation.id,
          type: ReservationActivityType.CREATED,
          actorId: actor.sub,
        },
      });

      const bumpableStages: LeadStage[] = [LeadStage.NEW, LeadStage.INTERESTED, LeadStage.VISIT];

      if (dto.leadId) {
        await tx.leadActivity.create({
          data: {
            leadId: dto.leadId,
            type: 'reservation',
            payload: {
              status: 'CREATED',
              reservationId: reservation.id,
              reservationNumber: reservation.reservationNumber,
              unitId: unit.id,
              unitCode: unit.code,
            },
          },
        });

        const previousStage = await tx.lead.findUnique({
          where: { id: dto.leadId },
          select: { stage: true },
        });
        if (previousStage && bumpableStages.includes(previousStage.stage)) {
          await tx.lead.update({
            where: { id: dto.leadId },
            data: { stage: LeadStage.NEGOTIATION },
          });
          await tx.leadActivity.create({
            data: {
              leadId: dto.leadId,
              type: 'status_change',
              payload: {
                from: previousStage.stage,
                to: LeadStage.NEGOTIATION,
                reason: `Reservation ${reservation.reservationNumber} created`,
              },
            },
          });
        }
      } else if (resolvedClientId) {
        const { leadId: targetLeadId } = await matchOrCreateLeadForClient(tx, {
          clientId: resolvedClientId,
          projectId: unit.building.phase.projectId,
          unitId: dto.unitId,
          bumpableStages,
          targetStage: LeadStage.NEGOTIATION,
          clientFullName,
          clientPhone: clientPhone ?? '',
          clientEmail,
          assignedSalesId: effectiveSalesId,
        });
        await tx.leadActivity.create({
          data: {
            leadId: targetLeadId,
            type: 'reservation',
            payload: {
              status: 'CREATED',
              reservationId: reservation.id,
              reservationNumber: reservation.reservationNumber,
              unitId: unit.id,
              unitCode: unit.code,
            },
          },
        });
      }

      return reservation;
    });
  }

  async stats() {
    const [total, pending, approved, rejected, cancelled, expired] =
      await this.prisma.$transaction([
        this.prisma.reservation.count(),
        this.prisma.reservation.count({ where: { status: ReservationStatus.PENDING } }),
        this.prisma.reservation.count({ where: { status: ReservationStatus.APPROVED } }),
        this.prisma.reservation.count({ where: { status: ReservationStatus.REJECTED } }),
        this.prisma.reservation.count({ where: { status: ReservationStatus.CANCELLED } }),
        this.prisma.reservation.count({ where: { status: ReservationStatus.EXPIRED } }),
      ]);
    return { total, pending, approved, rejected, cancelled, expired };
  }

  async list(opts: {
    page: number;
    pageSize: number;
    status?: ReservationStatus;
    salesId?: string;
    projectId?: string;
    unitId?: string;
    leadId?: string;
    clientId?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: Prisma.ReservationWhereInput = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.salesId ? { salesId: opts.salesId } : {}),
      ...(opts.unitId ? { unitId: opts.unitId } : {}),
      ...(opts.leadId ? { leadId: opts.leadId } : {}),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.projectId
        ? { unit: { building: { phase: { projectId: opts.projectId } } } }
        : {}),
      ...(opts.q
        ? {
            OR: [
              { lead: { fullName: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } },
              { lead: { phone: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } },
              { client: { fullName: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } },
              { client: { phone: { contains: opts.q, mode: Prisma.QueryMode.insensitive } } },
              { reservationNumber: { contains: opts.q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
      ...(opts.dateFrom || opts.dateTo
        ? {
            createdAt: {
              ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
              ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        include: {
          unit: { include: { building: { include: { phase: { include: { project: true } } } } } },
          sales: { select: { id: true, fullName: true } },
          lead: { select: { id: true, fullName: true, phone: true } },
          client: { select: { id: true, fullName: true, phone: true } },
          installmentPlanTemplate: {
            select: { id: true, name: true, reservationAmount: true },
          },
        },
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return paginate(data, total, opts);
  }

  async findOne(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: FULL_INCLUDE,
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  async setStatus(id: string, dto: UpdateReservationStatusDto, actor: AuthUser) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { unit: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    const FINAL: ReservationStatus[] = [
      ReservationStatus.REJECTED,
      ReservationStatus.CANCELLED,
      ReservationStatus.EXPIRED,
      ReservationStatus.CONVERTED,
    ];
    if (FINAL.includes(reservation.status)) {
      throw new BadRequestException(
        `Reservation is already ${reservation.status} and cannot be changed`,
      );
    }
    if (reservation.status === dto.status) return reservation;

    if (dto.status === ReservationStatus.EXPIRED) {
      throw new BadRequestException(
        'EXPIRED status can only be set automatically by the system',
      );
    }
    if (dto.status === ReservationStatus.CONVERTED) {
      throw new BadRequestException(
        'CONVERTED status is set automatically during contract conversion',
      );
    }

    const allowedFromPending: ReservationStatus[] = [
      ReservationStatus.APPROVED,
      ReservationStatus.REJECTED,
      ReservationStatus.CANCELLED,
    ];
    const allowedFromApproved: ReservationStatus[] = [ReservationStatus.CANCELLED];

    if (
      reservation.status === ReservationStatus.PENDING &&
      !allowedFromPending.includes(dto.status)
    ) {
      throw new BadRequestException(
        `Pending reservation can only transition to APPROVED, REJECTED, or CANCELLED`,
      );
    }
    if (
      reservation.status === ReservationStatus.APPROVED &&
      !allowedFromApproved.includes(dto.status)
    ) {
      throw new BadRequestException(
        'Approved reservation can only be cancelled',
      );
    }

    if (dto.status === ReservationStatus.CANCELLED) {
      const trimmedReason = dto.reason?.trim();
      if (!trimmedReason) {
        throw new BadRequestException('سبب الإلغاء مطلوب');
      }
      dto.reason = trimmedReason;
    }

    const now = new Date();
    const STATUS_TO_ACTIVITY: Partial<Record<ReservationStatus, ReservationActivityType>> = {
      [ReservationStatus.APPROVED]: ReservationActivityType.APPROVED,
      [ReservationStatus.REJECTED]: ReservationActivityType.REJECTED,
      [ReservationStatus.CANCELLED]: ReservationActivityType.CANCELLED,
      [ReservationStatus.EXPIRED]: ReservationActivityType.EXPIRED,
    };
    const activityType = STATUS_TO_ACTIVITY[dto.status];
    if (!activityType) {
      throw new BadRequestException(`Cannot transition reservation to status ${dto.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id },
        data: {
          status: dto.status,
          reason: dto.reason ?? null,
          approvedAt: dto.status === ReservationStatus.APPROVED ? now : undefined,
          rejectedAt: dto.status === ReservationStatus.REJECTED ? now : undefined,
          cancelledAt: dto.status === ReservationStatus.CANCELLED ? now : undefined,
        },
      });

      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          type: activityType,
          actorId: actor.sub,
          note: dto.reason ?? null,
        },
      });

      if (reservation.leadId) {
        await tx.leadActivity.create({
          data: {
            leadId: reservation.leadId,
            type: 'reservation',
            payload: {
              status: dto.status,
              reservationId: id,
              reservationNumber: reservation.reservationNumber,
              unitId: reservation.unitId,
              unitCode: reservation.unit.code,
              reason: dto.reason ?? null,
            },
          },
        });
      }

      if (
        dto.status === ReservationStatus.REJECTED ||
        dto.status === ReservationStatus.CANCELLED ||
        dto.status === ReservationStatus.EXPIRED
      ) {
        const otherActive = await tx.reservation.count({
          where: {
            unitId: reservation.unitId,
            id: { not: id },
            status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
          },
        });
        if (otherActive === 0 && reservation.unit.status === UnitStatus.RESERVED) {
          await tx.unit.update({
            where: { id: reservation.unitId },
            data: { status: UnitStatus.AVAILABLE, reservationExpiresAt: null },
          });
          await tx.unitStatusHistory.create({
            data: {
              unitId: reservation.unitId,
              oldStatus: UnitStatus.RESERVED,
              newStatus: UnitStatus.AVAILABLE,
              changedById: actor.sub,
              reason: dto.reason ?? `Reservation ${dto.status}`,
            },
          });
        }
      }
      return updated;
    });
  }

  async confirmBookingPayment(
    id: string,
    dto: ConfirmBookingPaymentDto,
    actor: AuthUser,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: { id: true, status: true, bookingAmount: true, bookingPaymentStatus: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (
      reservation.status !== ReservationStatus.PENDING &&
      reservation.status !== ReservationStatus.APPROVED
    ) {
      throw new BadRequestException(
        'يمكن تأكيد سداد الحجز فقط للحجوزات المعلقة أو المعتمدة',
      );
    }
    if (reservation.bookingAmount.lte(0)) {
      throw new BadRequestException('يجب تحديد مبلغ الحجز قبل تأكيد السداد');
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id },
        data: {
          bookingPaymentStatus: ReservationBookingPaymentStatus.PAID,
          bookingPaidAt: paidAt,
        },
      });
      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          type: ReservationActivityType.BOOKING_PAYMENT_CONFIRMED,
          actorId: actor.sub,
          note:
            dto.note?.trim()?.substring(0, 500) ??
            `تم تأكيد سداد مبلغ الحجز (${updated.bookingAmount.toString()})`,
        },
      });
      // Idempotent: remove any previous BOOKING_AMOUNT deposit, then re-create.
      await tx.deposit.deleteMany({
        where: { reservationId: id, type: DepositType.BOOKING_AMOUNT },
      });
      await tx.deposit.create({
        data: {
          type: DepositType.BOOKING_AMOUNT,
          reservationId: id,
          contractId: null,
          installmentId: null,
          amount: reservation.bookingAmount,
          paidAt,
          recordedById: actor.sub,
          verified: true,
        },
      });
      return updated;
    });
  }

  async unconfirmBookingPayment(
    id: string,
    dto: UnconfirmBookingPaymentDto,
    actor: AuthUser,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: { id: true, status: true, bookingPaymentStatus: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (reservation.bookingPaymentStatus !== ReservationBookingPaymentStatus.PAID) {
      throw new BadRequestException('مبلغ الحجز ليس في حالة "مدفوع"');
    }

    const newStatus = dto.newStatus ?? ReservationBookingPaymentStatus.UNPAID;
    if (newStatus === ReservationBookingPaymentStatus.PAID) {
      throw new BadRequestException('الحالة الجديدة يجب ألا تكون "مدفوع"');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id },
        data: {
          bookingPaymentStatus: newStatus,
          bookingPaidAt: null,
        },
      });
      await tx.deposit.deleteMany({
        where: { reservationId: id, type: DepositType.BOOKING_AMOUNT },
      });
      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          type: ReservationActivityType.BOOKING_PAYMENT_UNCONFIRMED,
          actorId: actor.sub,
          note: dto.note?.trim()?.substring(0, 500) ?? 'تم إلغاء تأكيد سداد مبلغ الحجز',
        },
      });
      return updated;
    });
  }

  async addNote(id: string, dto: AddNoteDto, actorId: string) {
    await this.findOne(id);
    const body = dto.body.trim();
    if (!body) {
      throw new BadRequestException('Note body cannot be empty');
    }
    const note = await this.prisma.reservationNote.create({
      data: {
        reservationId: id,
        body,
        authorId: actorId,
      },
      include: { author: { select: { id: true, fullName: true } } },
    });
    await this.prisma.reservationActivity.create({
      data: {
        reservationId: id,
        type: ReservationActivityType.NOTE_ADDED,
        actorId,
        note: body.substring(0, 100),
      },
    });
    return note;
  }

  async update(id: string, dto: UpdateReservationDto, actor: AuthUser) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        salesId: true,
        expiresAt: true,
        notes: true,
        unitId: true,
        bookingAmount: true,
        bookingPaymentStatus: true,
        installmentPlanTemplateId: true,
        sales: { select: { fullName: true } },
        unit: { select: { building: { select: { phase: { select: { projectId: true } } } } } },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    // Core reservation fields (sales/expiresIn/notes) are only editable while PENDING.
    // Booking payment fields are also editable on APPROVED reservations.
    const isCoreEdit =
      dto.salesId !== undefined ||
      dto.expiresInHours !== undefined ||
      dto.notes !== undefined;
    const isBookingEdit =
      dto.installmentPlanTemplateId !== undefined ||
      dto.bookingAmount !== undefined ||
      dto.bookingPaymentStatus !== undefined ||
      dto.bookingPaidAt !== undefined ||
      dto.bookingNotes !== undefined;

    if (isCoreEdit && reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('Only pending reservations can be edited');
    }
    if (
      isBookingEdit &&
      reservation.status !== ReservationStatus.PENDING &&
      reservation.status !== ReservationStatus.APPROVED
    ) {
      throw new BadRequestException(
        'حقول مبلغ الحجز قابلة للتعديل فقط على الحجوزات المعلقة أو المعتمدة',
      );
    }

    const data: Prisma.ReservationUpdateInput = {};
    const changes: string[] = [];

    if (dto.salesId && dto.salesId !== reservation.salesId) {
      const salesUser = await this.prisma.user.findUnique({
        where: { id: dto.salesId },
        select: { id: true, role: true, active: true, fullName: true },
      });
      if (!salesUser) throw new BadRequestException('Sales person not found');
      if (salesUser.role !== UserRole.SALES) {
        throw new BadRequestException('Selected user is not a sales person');
      }
      if (!salesUser.active) {
        throw new BadRequestException('Selected sales person is inactive');
      }
      data.sales = { connect: { id: salesUser.id } };
      changes.push(
        `تم تغيير المندوب من ${reservation.sales?.fullName ?? '—'} إلى ${salesUser.fullName}`,
      );
    }

    let newExpiresAt: Date | null = null;
    if (dto.expiresInHours !== undefined) {
      newExpiresAt = new Date(Date.now() + dto.expiresInHours * 3_600_000);
      data.expiresAt = newExpiresAt;
      changes.push(`تم تمديد الصلاحية حتى ${newExpiresAt.toISOString()}`);
    }

    if (dto.notes !== undefined && dto.notes !== reservation.notes) {
      data.notes = dto.notes;
      changes.push('تم تعديل الملاحظات');
    }

    // ── Booking amount fields ────────────────────────────────────────────
    if (dto.installmentPlanTemplateId !== undefined) {
      if (dto.installmentPlanTemplateId === null) {
        if (reservation.installmentPlanTemplateId) {
          data.installmentPlanTemplate = { disconnect: true };
          changes.push('تم إلغاء ربط خطة التقسيط');
        }
      } else {
        const plan = await this.validateBookingPlan(
          dto.installmentPlanTemplateId,
          reservation.unitId,
          reservation.unit.building.phase.projectId,
        );
        if (plan.id !== reservation.installmentPlanTemplateId) {
          data.installmentPlanTemplate = { connect: { id: plan.id } };
          changes.push('تم تحديث خطة التقسيط');
          // If admin did not also send a booking amount, default to plan's reservationAmount
          if (dto.bookingAmount === undefined) {
            data.bookingAmount = plan.reservationAmount;
            changes.push('تم تحديث مبلغ الحجز من خطة التقسيط');
          }
        }
      }
    }

    if (dto.bookingAmount !== undefined) {
      const amount = new Prisma.Decimal(dto.bookingAmount);
      if (!reservation.bookingAmount.eq(amount)) {
        data.bookingAmount = amount;
        changes.push(`تم تحديث مبلغ الحجز إلى ${amount.toString()}`);
      }
    }

    if (
      dto.bookingPaymentStatus !== undefined &&
      dto.bookingPaymentStatus !== reservation.bookingPaymentStatus
    ) {
      // Validate PAID requires non-zero amount unless WAIVED
      const newAmount = data.bookingAmount
        ? (data.bookingAmount as Prisma.Decimal)
        : reservation.bookingAmount;
      if (
        dto.bookingPaymentStatus === ReservationBookingPaymentStatus.PAID &&
        new Prisma.Decimal(newAmount as Prisma.Decimal.Value).lte(0)
      ) {
        throw new BadRequestException('مبلغ الحجز المدفوع يجب أن يكون أكبر من صفر');
      }
      data.bookingPaymentStatus = dto.bookingPaymentStatus;
      changes.push(`تم تحديث حالة سداد الحجز إلى ${dto.bookingPaymentStatus}`);
      // Auto-manage bookingPaidAt only when transitioning into/out of PAID and admin didn't set it explicitly
      if (dto.bookingPaidAt === undefined) {
        if (dto.bookingPaymentStatus === ReservationBookingPaymentStatus.PAID) {
          data.bookingPaidAt = new Date();
        } else {
          data.bookingPaidAt = null;
        }
      }
    }

    if (dto.bookingPaidAt !== undefined) {
      data.bookingPaidAt = dto.bookingPaidAt ? new Date(dto.bookingPaidAt) : null;
      changes.push('تم تحديث تاريخ سداد الحجز');
    }

    if (dto.bookingNotes !== undefined) {
      data.bookingNotes = dto.bookingNotes ?? null;
      changes.push('تم تحديث ملاحظات مبلغ الحجز');
    }

    if (changes.length === 0) {
      return this.findOne(id);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data });
      if (newExpiresAt) {
        await tx.unit.update({
          where: { id: reservation.unitId },
          data: { reservationExpiresAt: newExpiresAt },
        });
      }
      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          type: ReservationActivityType.NOTE_ADDED,
          actorId: actor.sub,
          note: changes.join(' • ').substring(0, 500),
        },
      });
      return tx.reservation.findUnique({ where: { id }, include: FULL_INCLUDE });
    });
  }

  async listActivitiesForOwner(opts: { clientId?: string; leadId?: string; limit?: number }) {
    return this.prisma.reservationActivity.findMany({
      where: {
        reservation: {
          ...(opts.clientId ? { clientId: opts.clientId } : {}),
          ...(opts.leadId ? { leadId: opts.leadId } : {}),
        },
      },
      include: {
        reservation: {
          select: {
            reservationNumber: true,
            unit: { select: { code: true } },
          },
        },
        actor: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 10,
    });
  }

  async convertReservation(id: string, dto: ConvertReservationDto, actor: AuthUser) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        unit: { include: { building: { include: { phase: { select: { projectId: true } } } } } },
        lead: { select: { id: true, clientId: true, stage: true } },
        client: { select: { id: true } },
        contract: { select: { id: true } },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (reservation.status !== ReservationStatus.APPROVED) {
      throw new BadRequestException('يجب أن يكون الحجز بحالة "معتمد" قبل التحويل إلى عقد');
    }
    if (reservation.contract) {
      throw new BadRequestException('تم تحويل هذا الحجز مسبقاً إلى عقد');
    }
    if (
      reservation.bookingAmount.gt(0) &&
      reservation.bookingPaymentStatus !== ReservationBookingPaymentStatus.PAID &&
      reservation.bookingPaymentStatus !== ReservationBookingPaymentStatus.WAIVED
    ) {
      throw new BadRequestException(
        'يجب تأكيد سداد مبلغ الحجز أو إعفاؤه قبل التحويل إلى عقد',
      );
    }
    // If the reservation is linked to a plan template, the full duration snapshot
    // must be present. Old reservations created before snapshot fields were added,
    // or ones where the user skipped selecting a duration, will be missing these
    // values — proceeding without them silently creates a broken contract (wrong
    // amounts, no installment plan).
    if (reservation.installmentPlanTemplateId != null) {
      if (
        reservation.selectedDurationMonths == null ||
        reservation.selectedIncreasePercentage == null ||
        reservation.snapshotDownPaymentAmount == null ||
        reservation.snapshotFinancedAmount == null ||
        reservation.snapshotMonthlyInstallment == null ||
        reservation.snapshotTotalPayable == null
      ) {
        throw new BadRequestException(
          'لا يمكن تحويل هذا الحجز إلى عقد لأنه لا يحتوي على مدة تقسيط محفوظة. اختر مدة التقسيط أولاً أو أعد إنشاء الحجز بالخطة المحدثة.',
        );
      }
    }

    if (reservation.selectedDurationMonths != null && !dto.startsAt) {
      throw new BadRequestException('تاريخ بدء التقسيط مطلوب عند وجود مدة تقسيط محددة');
    }

    // Resolve the customer: clientId on the reservation, or the lead's linked client.
    const customerId = reservation.clientId ?? reservation.lead?.clientId ?? null;
    if (!customerId) {
      throw new BadRequestException(
        'لا يمكن تحديد العميل المرتبط بهذا الحجز. تأكد من ربط العميل قبل التحويل.',
      );
    }

    // Build the contract amounts from snapshot values, falling back to unit price.
    const totalAmount: Prisma.Decimal =
      reservation.snapshotTotalPayable != null
        ? reservation.snapshotTotalPayable
        : new Prisma.Decimal(reservation.unit.price);
    const downPayment: Prisma.Decimal =
      reservation.snapshotDownPaymentAmount ?? new Prisma.Decimal(0);

    // Validate optional date strings before entering the transaction.
    if (dto.startsAt) {
      const d = new Date(dto.startsAt);
      if (isNaN(d.getTime())) {
        throw new BadRequestException('تاريخ بدء التقسيط غير صالح');
      }
    }
    if (dto.signedAt) {
      const d = new Date(dto.signedAt);
      if (isNaN(d.getTime())) {
        throw new BadRequestException('تاريخ توقيع العقد غير صالح');
      }
    }

    const now = new Date();

    // Retry up to 3 times in the rare case two conversions race on the same
    // contract number.  The root fix (max-based generator) makes this unlikely;
    // the retry is purely a safety net.
    for (let attempt = 0; attempt < 3; attempt++) {
      const contractNumber = await this.nextContractNumber();

      try {
        const result = await this.prisma.$transaction(async (tx) => {
          // 1. Create the Contract.
          const contract = await tx.contract.create({
            data: {
              contractNumber,
              customerId,
              unitId: reservation.unitId,
              reservationId: reservation.id,
              totalAmount,
              downPayment,
              pdfUrl: dto.pdfUrl ?? null,
              signedAt: dto.signedAt ? new Date(dto.signedAt) : null,
              // Inherit broker attribution from the source reservation — this
              // is the ONLY path that sets these fields on a contract. Direct
              // POST /contracts (the standalone create) does not accept them.
              brokerId: reservation.brokerId,
              brokerAgentId: reservation.brokerAgentId,
            },
          });

      // 2. Promote CLIENT → CUSTOMER.
      await tx.user.updateMany({
        where: { id: customerId, role: UserRole.CLIENT },
        data: { role: UserRole.CUSTOMER },
      });

      // 3. Mark unit SOLD.
      const previousUnitStatus = reservation.unit.status;
      await tx.unit.update({
        where: { id: reservation.unitId },
        data: { status: UnitStatus.SOLD, reservationExpiresAt: null },
      });
      await tx.unitStatusHistory.create({
        data: {
          unitId: reservation.unitId,
          oldStatus: previousUnitStatus,
          newStatus: UnitStatus.SOLD,
          changedById: actor.sub,
          reason: `Contract ${contractNumber}`,
        },
      });

      // 4. Generate InstallmentPlan + Installment rows from snapshot (if duration was selected).
      if (
        reservation.selectedDurationMonths != null &&
        reservation.snapshotMonthlyInstallment != null &&
        dto.startsAt
      ) {
        const startsAt = new Date(dto.startsAt);
        const plan = await tx.installmentPlan.create({
          data: {
            contractId: contract.id,
            totalMonths: reservation.selectedDurationMonths,
            monthlyAmount: reservation.snapshotMonthlyInstallment,
            startsAt,
            frequency: 'MONTHLY',
          },
        });

        // 4a. DOWN_PAYMENT row (before monthly installments).
        if (downPayment.gt(0)) {
          const downPaymentDueDate = dto.signedAt ? new Date(dto.signedAt) : now;
          await tx.installment.create({
            data: {
              planId: plan.id,
              type: PlanPaymentType.DOWN_PAYMENT,
              dueDate: downPaymentDueDate,
              amount: downPayment,
            },
          });
        }

        // 4b. Monthly INSTALLMENT rows.
        const rows: Prisma.InstallmentCreateManyInput[] = [];
        for (let i = 0; i < reservation.selectedDurationMonths; i++) {
          const dueDate = new Date(startsAt);
          dueDate.setMonth(dueDate.getMonth() + i);
          rows.push({
            planId: plan.id,
            type: PlanPaymentType.INSTALLMENT,
            dueDate,
            amount: reservation.snapshotMonthlyInstallment,
          });
        }
        await tx.installment.createMany({ data: rows });

        // 4c. FINAL_PAYMENT row (one period after the last monthly installment).
        if (reservation.snapshotFinalPaymentAmount?.gt(0)) {
          const finalDueDate = new Date(startsAt);
          finalDueDate.setMonth(finalDueDate.getMonth() + reservation.selectedDurationMonths);
          await tx.installment.create({
            data: {
              planId: plan.id,
              type: PlanPaymentType.FINAL_PAYMENT,
              dueDate: finalDueDate,
              amount: reservation.snapshotFinalPaymentAmount,
            },
          });
        }
      }

      // 5. Mark Reservation CONVERTED.
      await tx.reservation.update({
        where: { id },
        data: { status: ReservationStatus.CONVERTED, convertedAt: now },
      });
      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          type: ReservationActivityType.CONVERTED,
          actorId: actor.sub,
          note: `تم إنشاء العقد ${contractNumber}`,
        },
      });

      // 6. Advance lead to WON if the reservation was lead-based.
      if (reservation.lead) {
        const bumpableStages: LeadStage[] = [
          LeadStage.NEW, LeadStage.INTERESTED, LeadStage.VISIT,
          LeadStage.NEGOTIATION,
        ];
        if (bumpableStages.includes(reservation.lead.stage)) {
          await tx.lead.update({
            where: { id: reservation.lead.id },
            data: { stage: LeadStage.WON },
          });
          await tx.leadActivity.create({
            data: {
              leadId: reservation.lead.id,
              type: 'status_change',
              payload: { from: reservation.lead.stage, to: LeadStage.WON, reason: contractNumber },
            },
          });
        }
        await tx.leadActivity.create({
          data: {
            leadId: reservation.lead.id,
            type: 'reservation',
            payload: { status: 'CONVERTED', reservationId: id, contractId: contract.id, contractNumber },
          },
        });
        // Broker portal activity — surfaces as CONTRACT_CREATED in
        // /portal/activity. Optionally a second row when signedAt is set
        // at creation time (admins occasionally do both in one shot).
        if (reservation.brokerId) {
          await tx.leadActivity.create({
            data: {
              leadId: reservation.lead.id,
              type: 'broker_contract_created',
              payload: {
                brokerId: reservation.brokerId,
                brokerAgentId: reservation.brokerAgentId,
                contractId: contract.id,
                contractNumber,
                reservationId: id,
                reservationNumber: reservation.reservationNumber,
                unitId: reservation.unitId,
                projectId: reservation.unit.building.phase.projectId,
                totalAmount: totalAmount.toString(),
                downPayment: downPayment.toString(),
              },
            },
          });
          if (dto.signedAt) {
            await tx.leadActivity.create({
              data: {
                leadId: reservation.lead.id,
                type: 'broker_contract_signed',
                payload: {
                  brokerId: reservation.brokerId,
                  brokerAgentId: reservation.brokerAgentId,
                  contractId: contract.id,
                  contractNumber,
                  signedAt: dto.signedAt,
                },
              },
            });
          }
        }
      }

          return { contractId: contract.id, contractNumber };
        });

        // Post-transaction notifications — only fire when the contract is
        // broker-attributed. Best-effort: failures are logged but never thrown.
        if (reservation.brokerId) {
          try {
            const recipients = await this.prisma.brokerUser.findMany({
              where: { brokerId: reservation.brokerId, status: 'ACTIVE' },
              select: { userId: true },
            });
            const userIds = new Set<string>(recipients.map((r) => r.userId));
            // Internal sales user gets a notification too.
            const salesUserId =
              (await this.prisma.reservation.findUnique({
                where: { id },
                select: { salesId: true },
              }))?.salesId ?? null;
            if (salesUserId) userIds.add(salesUserId);

            if (userIds.size > 0) {
              const basePayload = {
                contractId: result.contractId,
                contractNumber: result.contractNumber,
                reservationId: id,
                unitId: reservation.unitId,
                projectId: reservation.unit.building.phase.projectId,
              };
              await this.prisma.notification.createMany({
                data: Array.from(userIds).map((userId) => ({
                  userId,
                  templateCode: 'broker_contract_created',
                  payload: basePayload as Prisma.InputJsonValue,
                  channel: NotificationChannel.IN_APP,
                  sentAt: new Date(),
                })),
              });
              if (dto.signedAt) {
                await this.prisma.notification.createMany({
                  data: Array.from(userIds).map((userId) => ({
                    userId,
                    templateCode: 'broker_contract_signed',
                    payload: {
                      ...basePayload,
                      signedAt: dto.signedAt,
                    } as Prisma.InputJsonValue,
                    channel: NotificationChannel.IN_APP,
                    sentAt: new Date(),
                  })),
                });
              }
            }
          } catch (notifyErr) {
            this.logger.warn(
              `Broker contract notify failed for reservation ${id}: ${(notifyErr as Error).message}`,
            );
          }
        }

        // Materialize the broker commission row only when the contract was
        // created already-signed. The standard path is: convert → contract
        // unsigned → admin PATCHes signedAt → ContractsService.update
        // materializes from there. Best-effort: a failure here is logged
        // but never propagated (the contract itself is already committed).
        if (reservation.brokerId && dto.signedAt) {
          try {
            await this.brokerCommissions.materializeFromContract(
              result.contractId,
            );
          } catch (commErr) {
            this.logger.warn(
              `materializeFromContract(${result.contractId}) failed: ${(commErr as Error).message}`,
            );
          }
        }

        return result;
      } catch (e: unknown) {
        const err = e as { code?: string; meta?: { target?: string[] } };
        const isDuplicateContractNumber =
          err?.code === 'P2002' &&
          Array.isArray(err?.meta?.target) &&
          err.meta!.target!.includes('contractNumber');
        if (isDuplicateContractNumber && attempt < 2) {
          // Race condition: another concurrent conversion grabbed the same number.
          // Regenerate on the next iteration.
          continue;
        }
        if (isDuplicateContractNumber) {
          throw new BadRequestException(
            'تعذّر إنشاء رقم العقد بعد عدة محاولات، يرجى المحاولة مرة أخرى.',
          );
        }
        throw e;
      }
    }
    // Unreachable — the loop always returns or throws, but TypeScript needs this.
    throw new BadRequestException('تعذّر إنشاء العقد، يرجى المحاولة مرة أخرى.');
  }

  async expireDue() {
    const due = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      select: {
        id: true,
        unitId: true,
        salesId: true,
        leadId: true,
        reservationNumber: true,
        unit: { select: { code: true } },
      },
    });
    for (const r of due) {
      await this.prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: r.id },
          data: { status: ReservationStatus.EXPIRED },
        });
        await tx.reservationActivity.create({
          data: {
            reservationId: r.id,
            type: ReservationActivityType.EXPIRED,
            actorId: null,
            note: 'Expired automatically',
          },
        });

        if (r.leadId) {
          await tx.leadActivity.create({
            data: {
              leadId: r.leadId,
              type: 'reservation',
              payload: {
                status: 'EXPIRED',
                reservationId: r.id,
                reservationNumber: r.reservationNumber,
                unitId: r.unitId,
                unitCode: r.unit.code,
              },
            },
          });
        }

        const otherActive = await tx.reservation.count({
          where: {
            unitId: r.unitId,
            id: { not: r.id },
            status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
          },
        });
        if (otherActive === 0) {
          const unit = await tx.unit.findUnique({ where: { id: r.unitId } });
          if (unit && unit.status === UnitStatus.RESERVED) {
            await tx.unit.update({
              where: { id: r.unitId },
              data: { status: UnitStatus.AVAILABLE, reservationExpiresAt: null },
            });
            await tx.unitStatusHistory.create({
              data: {
                unitId: r.unitId,
                oldStatus: UnitStatus.RESERVED,
                newStatus: UnitStatus.AVAILABLE,
                changedById: r.salesId,
                reason: 'Reservation expired',
              },
            });
          }
        }
      });
    }
    return { expired: due.length };
  }
}

@Injectable()
class ReservationExpiryCron {
  constructor(private readonly svc: ReservationsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run() {
    await this.svc.expireDue();
  }
}

@ApiTags('reservations')
@Controller('reservations')
class ReservationsController {
  constructor(private readonly svc: ReservationsService) {}

  @Roles(UserRole.SALES, UserRole.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReservationDto) {
    return this.svc.create(user, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('stats')
  stats() {
    return this.svc.stats();
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ReservationStatus,
    @Query('salesId') salesId?: string,
    @Query('projectId') projectId?: string,
    @Query('unitId') unitId?: string,
    @Query('leadId') leadId?: string,
    @Query('clientId') clientId?: string,
    @Query('q') q?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const effectiveSalesId = user.role === UserRole.SALES ? user.sub : salesId;
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      salesId: effectiveSalesId,
      projectId,
      unitId,
      leadId,
      clientId,
      q,
      dateFrom,
      dateTo,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('activities')
  listActivities(
    @Query('clientId') clientId?: string,
    @Query('leadId') leadId?: string,
    @Query('pageSize') pageSize = 10,
  ) {
    return this.svc.listActivitiesForOwner({ clientId, leadId, limit: Number(pageSize) });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.update(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.setStatus(id, dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Post(':id/notes')
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.addNote(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/convert')
  convertReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.convertReservation(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/booking-payment/confirm')
  confirmBookingPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmBookingPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.confirmBookingPayment(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/booking-payment/unconfirm')
  unconfirmBookingPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnconfirmBookingPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.unconfirmBookingPayment(id, dto, user);
  }
}

@Module({
  imports: [BrokerCommissionsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationExpiryCron],
  exports: [ReservationsService],
})
export class ReservationsModule {}
