import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Optional,
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
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DepositReviewStatus,
  DepositType,
  LeadStage,
  NotificationChannel,
  PlanPaymentType,
  PlanTemplateStatus,
  Prisma,
  ReservationActivityType,
  ReservationBookingAmountMode,
  ReservationBookingPaymentStatus,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { findTenantUser } from '../../common/tenant/resolve-tenant-entity';
import {
  digitsOnly,
  normalizeEmail,
  normalizePhone,
} from '../../common/utils/identity-match';
import { resolveSalesScope, assertSalesRecordInScope } from '../../common/utils/sales-scope';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions, PermissionsStrict } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { matchOrCreateLeadForClient } from '../crm/crm-lead-matching';
import { computeDurationOption } from '../installments/duration-calc';
import {
  NotificationsModule,
  NotificationsService,
} from '../notifications/notifications.module';
// P12 — convert delegates contract side effects (customer notification +
// CUSTOMER_VISIBLE contract-document registration) to ContractsService, the
// single source of truth for contract documents. ContractsModule exports the
// service; its dependency graph does not import reservations, so no cycle.
import { ContractsModule, ContractsService } from '../contracts/contracts.module';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { captureExceptionSafe } from '../../common/observability/sentry';
import { runTenantContext } from '../../common/tenant/tenant-context';
import { resolveTenantUser } from '../../common/tenant/resolve-tenant-entity';
// BrokerCommissionsModule/Service no longer imported here. Commission
// materialisation runs from ContractsService.sign() — the only path that
// signs a contract — and convert always produces an unsigned contract.

class CreateReservationDto {
  @IsUUID() unitId!: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() salesId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsInt() @Min(1) @Max(720) expiresInHours?: number;
  // Plan linkage: when provided AND no manual bookingAmount/Percent is sent,
  // the server copies plan.reservationAmount → bookingAmount (mode=FIXED).
  // bookingPaymentStatus / bookingPaidAt are intentionally NOT accepted on
  // create — they are derived by the confirm-payment flow.
  @IsOptional() @IsUUID() installmentPlanTemplateId?: string;
  // Required when the linked template has duration options; ignored otherwise.
  @IsOptional() @IsUUID() installmentPlanDurationOptionId?: string;
  @IsOptional() @IsString() bookingNotes?: string;
  // P8 — admin chooses booking amount mode.
  // FIXED      → bookingAmount required, > 0 (or, when omitted, copy from plan).
  // PERCENTAGE → bookingAmountPercent required, in (0, 100]; unit must have a
  //              price > 0. Server computes bookingAmount = unit.price * pct/100.
  @IsOptional() @IsEnum(ReservationBookingAmountMode)
  bookingAmountMode?: ReservationBookingAmountMode;
  @IsOptional() @IsNumber() @Min(0) bookingAmount?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bookingAmountPercent?: number;
}

/**
 * Internal type used by ReservationsService.setStatus(). The public
 * controller surface now exposes per-transition POST routes
 * (/approve, /reject, /cancel) that build this object internally;
 * the old PATCH /:id/status route has been removed.
 */
class UpdateReservationStatusDto {
  @IsEnum(ReservationStatus) status!: ReservationStatus;
  @IsOptional() @IsString() reason?: string;
}

/**
 * Body for POST /reservations/:id/reject and POST /reservations/:id/cancel.
 * `reason` is required at the service layer for CANCELLED, optional for
 * REJECTED; the existing setStatus implementation enforces this.
 */
class StatusChangeReasonDto {
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
  // `signedAt` is intentionally NOT accepted here. Conversion always creates
  // an unsigned contract; signing is a separate strict action via
  // POST /contracts/:id/sign (gated by @PermissionsStrict('contracts:sign')).
  // The global ValidationPipe's forbidNonWhitelisted rejects inbound
  // `signedAt` with 400, closing the convert→signed bypass.
  @IsOptional() @IsString() pdfUrl?: string;
  // P12 — optional file metadata for the uploaded contract document, so the
  // registered Document carries a proper fileName/mimeType/size in the Admin
  // Documents Center. Whitelisted by ValidationPipe; ignored when no pdfUrl.
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @IsOptional() @IsString() @MaxLength(120) mimeType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sizeBytes?: number;
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
  // Booking-payment evidence lives on the related Deposit (source of truth).
  // Surface the BOOKING_AMOUNT deposits so the detail page can link to them.
  deposits: {
    where: { type: DepositType.BOOKING_AMOUNT },
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      verified: true,
      receiptUrl: true,
      createdAt: true,
    },
  },
  reservationNotes: {
    orderBy: { createdAt: 'desc' as const },
    include: { author: { select: { id: true, fullName: true } } },
  },
  activities: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { id: true, fullName: true } } },
  },
};

/**
 * Customer-facing reservation projection. Returns only fields the customer
 * needs and intentionally OMITS broker attribution, internal notes, financial
 * snapshots beyond the booking amount, and any actor information beyond the
 * assigned sales rep's name. Used by GET /me/reservations.
 */
const ME_RESERVATION_SELECT = {
  id: true,
  reservationNumber: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  bookingAmount: true,
  bookingPaymentStatus: true,
  bookingPaidAt: true,
  // Gap 3 — surface the latest BOOKING_AMOUNT proof so the customer UI can
  // distinguish "submit" vs "pending review" vs "rejected (resubmit)". Only
  // safe scalars; the receipt is reached via the signed-download endpoint, so
  // no fileUrl is selected here.
  deposits: {
    where: { type: DepositType.BOOKING_AMOUNT },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { id: true, reviewStatus: true, rejectionReason: true },
  },
  unit: {
    select: {
      id: true,
      code: true,
      type: true,
      building: {
        select: {
          phase: {
            select: {
              project: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  },
  sales: { select: { id: true, fullName: true } },
} satisfies Prisma.ReservationSelect;

/**
 * Flatten the raw ME_RESERVATION_SELECT row into the customer-facing shape:
 * collapse the `deposits` array (latest BOOKING_AMOUNT proof) into a single
 * `bookingDeposit` field (or null). Keeps the /me/reservations payload stable
 * and additive — `bookingDeposit` is the only new field.
 */
function toMeReservation<
  T extends { deposits?: { id: string; reviewStatus: DepositReviewStatus; rejectionReason: string | null }[] },
>(row: T) {
  const { deposits, ...rest } = row;
  const latest = deposits?.[0] ?? null;
  return {
    ...rest,
    bookingDeposit: latest
      ? { id: latest.id, reviewStatus: latest.reviewStatus, rejectionReason: latest.rejectionReason }
      : null,
  };
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly contracts: ContractsService,
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
        reservationAmountType: true,
        reservationAmountValue: true,
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
      const salesUser = await resolveTenantUser(
        this.prisma,
        dto.salesId,
        { id: true, role: true, active: true },
        { expectRoles: [UserRole.SALES], label: 'Sales person not found', throwBadRequest: true },
      );
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
    let genericLeadId: string | null = null;
    if (dto.clientId) {
      const clientUser = await resolveTenantUser(
        this.prisma,
        dto.clientId,
        { id: true, role: true, active: true, fullName: true, phone: true, email: true },
        {
          expectRoles: [UserRole.CLIENT, UserRole.CUSTOMER],
          label: 'Client not found',
          throwBadRequest: true,
        },
      );
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
        select: { id: true, unitInterestId: true, projectInterestId: true, stage: true },
      });
      if (!lead) {
        throw new BadRequestException('Lead not found');
      }
      if (lead.stage === LeadStage.WON || lead.stage === LeadStage.LOST) {
        throw new BadRequestException(
          `Cannot create a reservation on a ${lead.stage} lead`,
        );
      }
      if (lead.unitInterestId && lead.unitInterestId !== dto.unitId) {
        throw new BadRequestException(
          'The selected lead is scoped to a different unit. Create a new opportunity for this unit.',
        );
      }
      if (!lead.unitInterestId && !lead.projectInterestId) {
        const [conflictReservation, conflictAppointment, linkedContract] = await Promise.all([
          this.prisma.reservation.findFirst({
            where: { leadId: dto.leadId, status: { not: ReservationStatus.CANCELLED } },
            select: { id: true },
          }),
          this.prisma.visitAppointment.findFirst({
            where: { leadId: dto.leadId, unitId: { not: null } },
            select: { id: true },
          }),
          this.prisma.contract.findFirst({
            where: { reservation: { leadId: dto.leadId } },
            select: { id: true },
          }),
        ]);
        if (conflictReservation || conflictAppointment || linkedContract) {
          throw new BadRequestException(
            'This generic lead already has committed activities. Create a new opportunity for this unit instead.',
          );
        }
        genericLeadId = lead.id;
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
    // P8 — booking amount mode + audit. Default to FIXED for back-compat
    // with the plan-driven path. PERCENTAGE only fires when admin explicitly
    // requests it via the DTO.
    let resolvedBookingAmountMode: ReservationBookingAmountMode =
      dto.bookingAmountMode ?? ReservationBookingAmountMode.FIXED;
    let resolvedBookingAmountPercent: Prisma.Decimal | null = null;
    let resolvedBookingAmountUnitPriceSnapshot: Prisma.Decimal | null = null;
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
      // When the plan's booking amount is PERCENTAGE-based, the booking amount
      // the customer pays is computed from the UNIT price (per spec) and
      // snapshotted on the reservation — mirroring the manual PERCENTAGE
      // override below. An explicit DTO override still wins (handled after).
      if (
        plan.reservationAmountType === 'PERCENTAGE' &&
        plan.reservationAmountValue.gt(0) &&
        new Prisma.Decimal(unit.price).gt(0)
      ) {
        const unitPrice = new Prisma.Decimal(unit.price);
        const percent = plan.reservationAmountValue;
        resolvedBookingAmount = unitPrice.mul(percent).div(100).toDecimalPlaces(2);
        resolvedBookingAmountMode = ReservationBookingAmountMode.PERCENTAGE;
        resolvedBookingAmountPercent = percent;
        resolvedBookingAmountUnitPriceSnapshot = unitPrice;
      }

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

    // P8 — Admin override of bookingAmount. If the admin chose PERCENTAGE
    // mode, compute from unit.price; if FIXED with an explicit amount, use
    // that. Otherwise fall back to plan-derived value (already in
    // resolvedBookingAmount).
    if (dto.bookingAmountMode === ReservationBookingAmountMode.PERCENTAGE) {
      if (dto.bookingAmountPercent == null || dto.bookingAmountPercent <= 0) {
        throw new BadRequestException(
          'يجب إدخال نسبة مبلغ الحجز (أكبر من صفر) عند اختيار وضع النسبة المئوية',
        );
      }
      const unitPrice = new Prisma.Decimal(unit.price);
      if (unitPrice.lte(0)) {
        throw new BadRequestException(
          'لا يمكن حساب مبلغ الحجز كنسبة لأن سعر الوحدة غير محدد',
        );
      }
      const percent = new Prisma.Decimal(dto.bookingAmountPercent);
      // bookingAmount = unitPrice * percent / 100, rounded to 2 decimals.
      resolvedBookingAmount = unitPrice
        .mul(percent)
        .div(100)
        .toDecimalPlaces(2);
      resolvedBookingAmountPercent = percent;
      resolvedBookingAmountUnitPriceSnapshot = unitPrice;
      resolvedBookingAmountMode = ReservationBookingAmountMode.PERCENTAGE;
    } else if (dto.bookingAmount != null) {
      // FIXED with admin-provided amount.
      if (dto.bookingAmount <= 0) {
        throw new BadRequestException('مبلغ الحجز يجب أن يكون أكبر من صفر');
      }
      resolvedBookingAmount = new Prisma.Decimal(dto.bookingAmount);
      resolvedBookingAmountMode = ReservationBookingAmountMode.FIXED;
    }
    // else: FIXED, no override → keep plan-derived value (or 0 when no plan).

    // Payment status on create is always UNPAID; payment is confirmed later
    // via POST /reservations/:id/booking-payment/confirm.
    const resolvedPaymentStatus = ReservationBookingPaymentStatus.UNPAID;
    const resolvedPaidAt: Date | null = null;

    return this.prisma.$transaction(async (tx) => {
      // Atomic unit claim: the WHERE clause on status guarantees that only one
      // concurrent transaction can transition AVAILABLE → RESERVED. A second
      // request that reaches this point after the first has committed will see
      // count === 0 and throw before any Reservation row is written, rolling
      // back the entire transaction with no partial writes.
      const claimed = await tx.unit.updateMany({
        where: { id: dto.unitId, status: UnitStatus.AVAILABLE },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: expiresAt },
      });
      if (claimed.count === 0) throw new ConflictException('Unit is no longer available');

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
          bookingAmountMode: resolvedBookingAmountMode,
          bookingAmountPercent: resolvedBookingAmountPercent,
          bookingAmountUnitPriceSnapshot: resolvedBookingAmountUnitPriceSnapshot,
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
            data: {
              stage: LeadStage.NEGOTIATION,
              // Upgrade a clean generic lead to be scoped to this project/unit.
              ...(genericLeadId === dto.leadId
                ? {
                    unitInterestId: dto.unitId,
                    projectInterestId: unit.building.phase.projectId,
                  }
                : {}),
            },
          });
          await tx.leadActivity.create({
            data: {
              leadId: dto.leadId,
              type: 'status_change',
              payload: {
                from: previousStage.stage,
                to: LeadStage.NEGOTIATION,
                reason: `Reservation ${reservation.reservationNumber} created`,
                ...(genericLeadId === dto.leadId ? { upgraded: 'generic_to_unit' } : {}),
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
        // Persist the resolved lead back to the reservation so convertReservation
        // can reliably find the correct lead via reservation.lead.
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { leadId: targetLeadId },
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
    }).then(async (reservation) => {
      // P4 — event: sales or broker created a reservation; admins + sales
      // managers get a heads-up. Side-effects after the tx commits, helpers
      // never throw.
      await this.notifications.sendToRoles(
        [UserRole.ADMIN, UserRole.SALES_MANAGER],
        'reservation_submitted_admin',
        await this.buildReservationPayload(reservation.id),
      );
      // Gap 3 — ask the customer to pay the booking amount. Only when the
      // reservation is owned by a real customer (clientId) AND a positive
      // booking amount is due. Best-effort (sendToUser never throws past
      // here), so a missing template / push failure can't fail creation. The
      // payload carries deep-link metadata (entityType/entityId/action) for
      // the notification-center routing added in Gap 1.
      if (resolvedClientId && resolvedBookingAmount.gt(0)) {
        await this.notifications.sendToUser(
          resolvedClientId,
          'reservation_payment_requested',
          await this.buildReservationPayload(reservation.id, {
            entityType: 'reservation',
            entityId: reservation.id,
            action: 'pay_booking_amount',
            bookingAmount: resolvedBookingAmount.toString(),
          }),
        );
      }
      return reservation;
    });
  }

  /** Build a safe payload for a reservation notification. Whitelist: unit
   *  code, project name, status, reservation number, scheduled date.
   *  Errors are swallowed so payload composition never blocks the action. */
  private async buildReservationPayload(
    reservationId: string,
    extras: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    try {
      const r = await this.prisma.reservation.findUnique({
        where: { id: reservationId },
        select: {
          reservationNumber: true,
          status: true,
          unit: {
            select: {
              code: true,
              building: {
                select: { phase: { select: { project: { select: { name: true } } } } },
              },
            },
          },
          client: { select: { fullName: true } },
        },
      });
      if (!r) return { reservationId, ...extras };
      const project = r.unit?.building?.phase?.project?.name as
        | { ar?: string; en?: string }
        | undefined;
      return {
        reservationId,
        reference: r.reservationNumber ?? '',
        unitCode: r.unit?.code ?? '',
        projectName: project?.ar || project?.en || '',
        customerName: r.client?.fullName ?? '',
        status: r.status,
        ...extras,
      };
    } catch {
      return { reservationId, ...extras };
    }
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
    salesIds?: string[];
    projectId?: string;
    unitId?: string;
    leadId?: string;
    clientId?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: Prisma.ReservationWhereInput = {
      deletedAt: null,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.salesIds
        ? { salesId: { in: opts.salesIds } }
        : opts.salesId
          ? { salesId: opts.salesId }
          : {}),
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

  async softDelete(id: string) {
    const exists = await this.prisma.reservation.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
    if (!exists) throw new NotFoundException('Reservation not found');
    if (exists.deletedAt) throw new NotFoundException('Reservation already deleted');
    await this.prisma.reservation.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    const exists = await this.prisma.reservation.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
    if (!exists) throw new NotFoundException('Reservation not found');
    await this.prisma.reservation.update({ where: { id }, data: { deletedAt: null } });
  }

  /**
   * Build the OR clause that resolves "reservations belonging to this user".
   *
   * P9 — extended to handle two historical data shapes that P8 missed:
   *  - phone format drift between User.phone and Lead.phone (e.g. the same
   *    number stored with vs. without a leading `+` or with vs. without the
   *    country code) — we now match on digits-only normalized form.
   *  - cases where the lead points at a *synthetic* peer User row and the
   *    fallback contact field is on that peer rather than on the lead itself.
   *    We resolve "identity peers" (any User whose normalized phone/email
   *    matches the logged-in user's) and OR-match on every reservation
   *    pointing at any peer, directly OR through a lead.
   *
   * Match paths (all anchored by an exact-after-normalize comparison —
   * never fuzzy, never partial suffix):
   *
   *  - Direct:           Reservation.clientId = userId
   *  - Lead:             Reservation.lead.clientId = userId
   *  - Identity peers:   Reservation.clientId ∈ peerIds
   *                  OR  Reservation.lead.clientId ∈ peerIds
   *  - Lead contact:     Reservation.lead.phone (normalized) = user.phone (normalized)
   *                  OR  Reservation.lead.email (lowercased)  = user.email (lowercased)
   *
   * `User.phone` and `User.email` are unique columns, so peer-by-contact
   * lookup is bounded to at most ONE row per contact field — the match can
   * never accidentally surface another user's reservations.
   */
  private async buildUserOwnershipFilter(
    userId: string,
  ): Promise<Prisma.ReservationWhereInput[]> {
    const contact = await findTenantUser(this.prisma, userId, { phone: true, email: true });
    const phoneDigits = normalizePhone(contact?.phone ?? null);
    const emailKey = normalizeEmail(contact?.email ?? null);

    // Resolve identity peers — every User row whose normalized phone or
    // canonical email matches the logged-in user's. Always includes the
    // logged-in user themselves. Unique columns bound this to ≤2 extra rows.
    const peerIds = new Set<string>([userId]);
    if (phoneDigits) {
      // Prisma can't normalize during the where clause, so we scan the
      // small set of rows that share a digit suffix and verify in JS. The
      // suffix is the LAST 8 digits — enough to forgive a dropped country
      // code while bounding the scan via the `phone` index.
      const suffix = phoneDigits.slice(-8);
      const candidates = await this.prisma.user.findMany({
        where: { phone: { contains: suffix } },
        select: { id: true, phone: true },
      });
      for (const u of candidates) {
        if (normalizePhone(u.phone) === phoneDigits) peerIds.add(u.id);
      }
    }
    if (emailKey) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: emailKey },
        select: { id: true },
      });
      if (byEmail) peerIds.add(byEmail.id);
    }
    const peerArray = Array.from(peerIds);

    const or: Prisma.ReservationWhereInput[] = [
      { clientId: { in: peerArray } },
      { lead: { is: { clientId: { in: peerArray } } } },
    ];
    // Lead carries contact fields directly too (e.g. an unauthenticated
    // public visit-request stores phone on the Lead before any User row is
    // created). Match those independently.
    if (emailKey) {
      or.push({ lead: { is: { email: { equals: emailKey, mode: 'insensitive' } } } });
    }
    if (phoneDigits) {
      // Same digit-suffix narrowing as above; verification happens at the
      // User layer (since the peers query already pulled the right rows).
      // For leads we keep a literal match on the leading-`+` form AND the
      // digit-only form to cover the common storage variants without raw
      // SQL.
      const variants = new Set<string>();
      variants.add(phoneDigits);
      variants.add(`+${phoneDigits}`);
      // The user's actual stored phone (if any) — covers casing/whitespace
      // we may have stripped.
      if (contact?.phone) variants.add(contact.phone);
      or.push({ lead: { is: { phone: { in: Array.from(variants) } } } });
    }
    return or;
  }

  /**
   * Customer-facing reservation list. See [buildUserOwnershipFilter] for the
   * scoping rules. Returns only the fields the customer needs (unit, project,
   * sales rep, status, booking amount + payment state, expiry, reservation
   * number). Internal-only fields (notes, broker attribution, commission,
   * financial snapshots beyond bookingAmount) are intentionally omitted.
   */
  async listForUser(
    userId: string,
    opts: { page: number; pageSize: number; status?: ReservationStatus },
  ) {
    const where: Prisma.ReservationWhereInput = {
      deletedAt: null,
      ...(opts.status ? { status: opts.status } : {}),
      OR: await this.buildUserOwnershipFilter(userId),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        select: ME_RESERVATION_SELECT,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return paginate(data.map(toMeReservation), total, opts);
  }

  /**
   * Customer-facing reservation detail. Returns 404 unless the reservation is
   * owned by the user via one of the paths in [buildUserOwnershipFilter].
   * Returning 404 (not 403) is deliberate — we don't disclose existence of
   * other customers' rows.
   */
  async findOneForUser(id: string, userId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id,
        OR: await this.buildUserOwnershipFilter(userId),
      },
      select: ME_RESERVATION_SELECT,
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return toMeReservation(reservation);
  }

  /**
   * Customer-facing count: total reservations across all ownership paths.
   * Used by the account dashboard summary tile.
   */
  async countForUser(userId: string): Promise<number> {
    return this.prisma.reservation.count({
      where: { OR: await this.buildUserOwnershipFilter(userId) },
    });
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
    }).then(async (updated) => {
      // P4 — event: reservation status changed. Notify the customer/client
      // and the assigned sales user; ADMINs already saw the submit event so
      // we don't re-broadcast to the role for every transition.
      const payload = await this.buildReservationPayload(updated.id);
      await this.notifications.sendToUsers(
        [updated.clientId, updated.salesId],
        'reservation_status_changed',
        payload,
      );
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
        'يمكن تأكيد استلام مبلغ الحجز فقط للحجوزات المعلقة أو المعتمدة',
      );
    }
    if (reservation.bookingAmount.lte(0)) {
      throw new BadRequestException('يجب تحديد مبلغ الحجز قبل تأكيد الاستلام');
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
            `تم تأكيد استلام مبلغ الحجز (${updated.bookingAmount.toString()})`,
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
    }).then(async (updated) => {
      // P4 — event: booking payment confirmed. Notify customer + sales rep.
      const payload = await this.buildReservationPayload(updated.id);
      await this.notifications.sendToUsers(
        [updated.clientId, updated.salesId],
        'reservation_booking_paid',
        payload,
      );
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
          note: dto.note?.trim()?.substring(0, 500) ?? 'تم إلغاء تأكيد استلام مبلغ الحجز',
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
      const salesUser = await resolveTenantUser(
        this.prisma,
        dto.salesId,
        { id: true, role: true, active: true, fullName: true },
        { expectRoles: [UserRole.SALES], label: 'Sales person not found', throwBadRequest: true },
      );
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
        lead: {
          select: {
            id: true,
            clientId: true,
            stage: true,
            unitInterestId: true,
            fullName: true,
            phone: true,
            email: true,
          },
        },
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
        'يجب تأكيد استلام مبلغ الحجز أو إعفاؤه قبل التحويل إلى عقد',
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
              // Conversion always creates an unsigned contract. Signing flows
              // through POST /contracts/:id/sign (strict permission), which
              // also fires the broker_contract_signed activity / notification
              // / materializeFromContract side effects.
              signedAt: null,
              // Inherit broker attribution from the source reservation — this
              // is the ONLY path that sets these fields on a contract. Direct
              // POST /contracts (the standalone create) does not accept them.
              brokerId: reservation.brokerId,
              brokerAgentId: reservation.brokerAgentId,
            },
          });

      // 2. PROMOTION RULE — CLIENT → CUSTOMER fires here because convert()
      // always creates a contract (step 1 above). Mirror: contracts.module.ts
      // create(). Reservation.create alone must never promote — see
      // MeReservationsController docstring and e2e:
      // apps/api/test/e2e/me-reservations.e2e-spec.ts.
      const promoted = await tx.user.updateMany({
        where: { id: customerId, role: UserRole.CLIENT },
        data: { role: UserRole.CUSTOMER },
      });
      // Invalidate active refresh tokens so the portal immediately reflects the
      // new CUSTOMER role — the user is bounced to /login on next page load
      // instead of seeing a stale CLIENT view for up to 15 minutes.
      if (promoted.count > 0) {
        await tx.refreshToken.updateMany({
          where: { userId: customerId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

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
          const downPaymentDueDate = now;
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

      // 6. Advance the correct lead to WON.
      // Spread into a local variable — never mutate the Prisma result object.
      let targetLead = reservation.lead ? { ...reservation.lead } : null;

      const wonBumpableStages: LeadStage[] = [
        LeadStage.NEW, LeadStage.INTERESTED, LeadStage.VISIT, LeadStage.NEGOTIATION,
      ];

      // Fallback A: legacy client-linked reservation where leadId was not persisted.
      // Find the most recent open lead for this client on this exact unit.
      if (!targetLead && customerId) {
        const found = await tx.lead.findFirst({
          where: {
            clientId: customerId,
            unitInterestId: reservation.unitId,
            stage: { in: wonBumpableStages },
          },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true, stage: true, unitInterestId: true,
            fullName: true, phone: true, email: true, clientId: true,
          },
        });
        if (found) {
          await tx.reservation.update({ where: { id }, data: { leadId: found.id } });
          targetLead = found;
        }
      }

      // Fallback B: lead is linked but scoped to a different unit (legacy data).
      // Find or create the correct unit-specific lead and relink the reservation.
      if (
        targetLead &&
        targetLead.unitInterestId &&
        targetLead.unitInterestId !== reservation.unitId
      ) {
        const staleLeadId = targetLead.id;
        const leadClientId = targetLead.clientId ?? customerId;

        let correctLead = await tx.lead.findFirst({
          where: {
            clientId: leadClientId,
            unitInterestId: reservation.unitId,
            stage: { in: wonBumpableStages },
          },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true, stage: true, unitInterestId: true,
            fullName: true, phone: true, email: true, clientId: true,
          },
        });

        if (!correctLead) {
          const created = await tx.lead.create({
            data: {
              clientId: leadClientId,
              fullName: targetLead.fullName,
              phone: targetLead.phone,
              email: targetLead.email,
              projectInterestId: reservation.unit.building.phase.projectId,
              unitInterestId: reservation.unitId,
              stage: LeadStage.NEGOTIATION,
              assignedSalesId: reservation.salesId,
            },
            select: {
              id: true, stage: true, unitInterestId: true,
              fullName: true, phone: true, email: true, clientId: true,
            },
          });
          await tx.leadActivity.create({
            data: {
              leadId: created.id,
              type: 'created',
              payload: { reason: 'relinked_from_conversion' },
            },
          });
          correctLead = created;
        }

        await tx.reservation.update({ where: { id }, data: { leadId: correctLead.id } });

        // Audit trail on both leads so the history is traceable.
        await tx.leadActivity.create({
          data: {
            leadId: staleLeadId,
            type: 'relinked_away',
            payload: { toLeadId: correctLead.id, reason: 'unit_mismatch_on_conversion', contractNumber },
          },
        });
        await tx.leadActivity.create({
          data: {
            leadId: correctLead.id,
            type: 'relinked_from',
            payload: { fromLeadId: staleLeadId, reservationId: id, contractNumber },
          },
        });

        targetLead = correctLead;
      }

      if (targetLead) {
        if (wonBumpableStages.includes(targetLead.stage)) {
          await tx.lead.update({
            where: { id: targetLead.id },
            data: { stage: LeadStage.WON },
          });
          await tx.leadActivity.create({
            data: {
              leadId: targetLead.id,
              type: 'status_change',
              payload: { from: targetLead.stage, to: LeadStage.WON, reason: contractNumber },
            },
          });
        }
        await tx.leadActivity.create({
          data: {
            leadId: targetLead.id,
            type: 'reservation',
            payload: { status: 'CONVERTED', reservationId: id, contractId: contract.id, contractNumber },
          },
        });
        // Broker portal activity — surfaces as CONTRACT_CREATED in /portal/activity.
        if (reservation.brokerId) {
          await tx.leadActivity.create({
            data: {
              leadId: targetLead.id,
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
          // The `broker_contract_signed` LeadActivity row is no longer
          // written here — conversion now produces an unsigned contract.
          // Signing flows through POST /contracts/:id/sign, which fires
          // the activity from ContractsService.sign().
        }
      }

          return { contractId: contract.id, contractNumber };
        });

        // P4 — Broker fan-out via NotificationsService. Recipient list +
        // dedup + per-recipient error swallowing are handled by sendToUsers.
        // Customer-facing 'reservation_status_changed' was already fired by
        // setStatus(); convert is admin-driven so it also re-broadcasts the
        // status to the customer + sales.
        if (reservation.brokerId) {
          const brokerRecipients = await this.prisma.brokerUser.findMany({
            where: { brokerId: reservation.brokerId, status: 'ACTIVE' },
            select: { userId: true },
          });
          const salesUserId =
            (await this.prisma.reservation.findUnique({
              where: { id },
              select: { salesId: true },
            }))?.salesId ?? null;
          const payload = {
            reservationId: id,
            reference: result.contractNumber,
            unitCode: reservation.unit.code,
            projectName: '', // omitted intentionally; safe whitelist
          };
          await this.notifications.sendToUsers(
            [...brokerRecipients.map((r) => r.userId), salesUserId],
            'broker_contract_created',
            payload,
          );
        }
        // Notify the customer/client and sales of the converted status too.
        await this.notifications.sendToUsers(
          [reservation.clientId, reservation.salesId],
          'reservation_status_changed',
          await this.buildReservationPayload(id),
        );

        // P12 — contract side effects (single source of truth in
        // ContractsService): notify the customer their contract was created
        // and, when the admin uploaded a file during conversion, register it
        // as a CUSTOMER_VISIBLE CONTRACT document (Documents Center + customer
        // signed-download) and notify it's available. Best-effort — the
        // contract is already committed; a document/notification failure must
        // never fail the conversion.
        await this.contracts.handleConvertedContract(
          result.contractId,
          customerId,
          actor.sub,
          dto.pdfUrl
            ? {
                fileUrl: dto.pdfUrl,
                fileName: dto.fileName,
                mimeType: dto.mimeType,
                sizeBytes: dto.sizeBytes,
              }
            : undefined,
        );

        // Broker commission materialization is performed by
        // ContractsService.sign() — the only path that signs a contract.
        // Convert always produces an unsigned contract, so no commission
        // is materialized at conversion time.

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
          where: { id: r.id, status: ReservationStatus.PENDING },
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
export class ReservationExpiryCron {
  private readonly logger = new Logger(ReservationExpiryCron.name);

  constructor(
    private readonly svc: ReservationsService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run() {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      try {
        const result = this.lock
          ? await this.lock.withLock('reservation-expiry', 4 * 60_000, () => this.svc.expireDue())
          : await this.svc.expireDue();
        if (result !== null) {
          this.logger.log(`Reservation expiry sweep: expired=${result.expired}`);
        }
      } catch (err) {
        this.logger.error(`[reservation-expiry] cron failed: ${(err as Error).message}`);
        captureExceptionSafe(err, { job: 'reservation-expiry' });
      }
    });
  }
}

@ApiTags('reservations')
@Controller('reservations')
class ReservationsController {
  constructor(
    private readonly svc: ReservationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(UserRole.SALES, UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('reservations:create')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReservationDto) {
    return this.svc.create(user, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('reservations:read')
  @Get('stats')
  stats() {
    return this.svc.stats();
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('reservations:read')
  @Get()
  async list(
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
    const scope = await resolveSalesScope(this.prisma, user, salesId);
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      ...scope,
      projectId,
      unitId,
      leadId,
      clientId,
      q,
      dateFrom,
      dateTo,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('reservations:read')
  @Get('activities')
  listActivities(
    @Query('clientId') clientId?: string,
    @Query('leadId') leadId?: string,
    @Query('pageSize') pageSize = 10,
  ) {
    return this.svc.listActivitiesForOwner({ clientId, leadId, limit: Number(pageSize) });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('reservations:read')
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.assertReservationInScope(user, id);
    return this.svc.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reservations:update')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.update(id, dto, user);
  }

  // Notes intentionally left without @Permissions — SALES users add notes
  // routinely while working a reservation; the @Roles gate is sufficient.
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Post(':id/notes')
  async addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.assertReservationInScope(user, id);
    return this.svc.addNote(id, dto, user.sub);
  }

  // ADMIN: no-op. SALES: only own reservations (salesId = self).
  // SALES_MANAGER: only reservations owned by reps on their team.
  private async assertReservationInScope(user: AuthUser, id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: { salesId: true },
    });
    await assertSalesRecordInScope(this.prisma, user, reservation?.salesId ?? null, {
      mode: 'forbidden',
    });
  }

  // Strict: approval is the gate that lets a reservation proceed to contract
  // conversion. Classic SoD — separate creator from approver.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:approve')
  @Post(':id/approve')
  approveReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.setStatus(id, { status: ReservationStatus.APPROVED }, user);
  }

  // Strict: rejection frees the unit and writes a permanent rejection record.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:reject')
  @Post(':id/reject')
  rejectReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeReasonDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.setStatus(
      id,
      { status: ReservationStatus.REJECTED, reason: dto.reason },
      user,
    );
  }

  // Strict: cancellation also frees the unit, and can fire from APPROVED.
  // Service enforces that `reason` is non-empty.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:cancel')
  @Post(':id/cancel')
  cancelReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeReasonDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.setStatus(
      id,
      { status: ReservationStatus.CANCELLED, reason: dto.reason },
      user,
    );
  }

  // Strict: the most consequential transition — creates Contract, marks Unit
  // SOLD, generates installment plan, materializes broker commission.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:convert')
  @Post(':id/convert')
  convertReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.convertReservation(id, dto, user);
  }

  // Strict: confirm inserts an auto-verified Deposit row of type
  // BOOKING_AMOUNT; unconfirm deletes it. Symmetric pairing under one code.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:booking-payment')
  @Post(':id/booking-payment/confirm')
  confirmBookingPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmBookingPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.confirmBookingPayment(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:booking-payment')
  @Post(':id/booking-payment/unconfirm')
  unconfirmBookingPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnconfirmBookingPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.unconfirmBookingPayment(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reservations:delete')
  @Delete(':id')
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.softDelete(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reservations:delete')
  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.restore(id);
  }
}

/**
 * Customer-facing reservation surface — kept SEPARATE from the admin/sales
 * controller because the gating, response shape, and scoping rules differ:
 *  - Auth: @Roles(CLIENT, CUSTOMER) — both can see their own reservations.
 *    CLIENT users intentionally remain CLIENT after a reservation is created;
 *    role promotion to CUSTOMER happens ONLY on contract create or convert
 *    (see contracts.module.ts and convertReservation() in this file).
 *  - Scope: queries are pinned to `user.sub` across both ownership paths
 *    (direct `clientId` AND lead-based `lead.clientId`).
 *  - Shape: ME_RESERVATION_SELECT omits broker attribution, internal notes,
 *    and financial snapshots beyond bookingAmount.
 */
@ApiTags('me-reservations')
@Controller('me/reservations')
class MeReservationsController {
  constructor(private readonly svc: ReservationsService) {}

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ReservationStatus,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
  ) {
    return this.svc.listForUser(user.sub, {
      page: Number(page),
      pageSize: Number(pageSize),
      status,
    });
  }

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findOneForUser(id, user.sub);
  }
}

@Module({
  imports: [NotificationsModule, ContractsModule],
  controllers: [ReservationsController, MeReservationsController],
  providers: [ReservationsService, ReservationExpiryCron],
  exports: [ReservationsService],
})
export class ReservationsModule {}
