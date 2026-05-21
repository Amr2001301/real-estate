import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationChannel,
  PlanTemplateStatus,
  Prisma,
  ReservationActivityType,
  ReservationBookingPaymentStatus,
  ReservationStatus,
  UnitStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import { computeDurationOption } from '../installments/duration-calc';
// We import the existing service (ReservationsModule re-exports it) to reuse
// `nextReservationNumber()` and `validateBookingPlan()` — both made public to
// avoid duplicating logic. Behavior is otherwise untouched.
import { ReservationsService } from '../reservations/reservations.module';
import {
  CreatePortalReservationDto,
  PortalReservationsQueryDto,
} from './dto/portal-reservation.dto';

// Reservation statuses that consider a unit "actively reserved" — used to
// block duplicate reservations on the same unit / same lead+unit.
const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.APPROVED,
  ReservationStatus.CONVERTED,
];

const PORTAL_RESERVATION_INCLUDE = {
  unit: {
    select: {
      id: true,
      code: true,
      type: true,
      price: true,
      status: true,
      area: true,
      bedrooms: true,
      bathrooms: true,
      floor: true,
      building: {
        select: {
          id: true,
          name: true,
          phase: {
            select: {
              id: true,
              projectId: true,
              project: {
                select: { id: true, name: true, city: true, status: true },
              },
            },
          },
        },
      },
    },
  },
  lead: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      brokerApprovalStatus: true,
      stage: true,
    },
  },
  client: {
    select: { id: true, fullName: true, phone: true, email: true },
  },
  sales: {
    select: { id: true, fullName: true, email: true, phone: true },
  },
  installmentPlanTemplate: {
    select: {
      id: true,
      name: true,
      netPrice: true,
      reservationAmount: true,
      downPaymentAmount: true,
    },
  },
  selectedDurationOption: {
    select: { id: true, durationMonths: true, increasePercentage: true },
  },
} as const;

@Injectable()
export class BrokerPortalReservationsService {
  private readonly logger = new Logger(BrokerPortalReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
  ) {}

  // ── List + Detail ───────────────────────────────────────────────────────

  async list(scope: BrokerScopeContext, query: PortalReservationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ReservationWhereInput = {
      brokerId: scope.brokerId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.projectId
        ? { unit: { building: { phase: { projectId: query.projectId } } } }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...takeSkip({ page, pageSize }),
        include: PORTAL_RESERVATION_INCLUDE,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  async findOne(scope: BrokerScopeContext, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, brokerId: scope.brokerId },
      include: {
        ...PORTAL_RESERVATION_INCLUDE,
        reservationNotes: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { author: { select: { id: true, fullName: true } } },
        },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  // ── Create ──────────────────────────────────────────────────────────────

  /** Portal entry-point — auth = broker. Delegates to the shared core below. */
  async create(scope: BrokerScopeContext, dto: CreatePortalReservationDto) {
    return this.createForActor({
      brokerId: scope.brokerId,
      brokerAgentUserId: scope.brokerAgentUserId,
      actorUserId: scope.brokerAgentUserId,
      origin: 'BROKER_PORTAL',
      dto,
    });
  }

  /**
   * Shared broker-reservation creation core. Used by:
   *   - portal `create(scope, dto)` — broker creating their own reservation.
   *   - admin `createOnBehalfOfBroker(...)` (Phase 18A) — admin entering a
   *     reservation a broker phoned in.
   *
   * Identity inputs are explicit:
   *   - `brokerId`              — owning broker firm.
   *   - `brokerAgentUserId`     — the broker agent attribution (nullable for
   *                               admin paths where the agent isn't named).
   *   - `actorUserId`           — the User whose action this is. Used for
   *                               UnitStatusHistory.changedById and the
   *                               ReservationActivity actor.
   *   - `origin`                — narrative tag stored in the lead activity
   *                               payload so admins can tell portal-submitted
   *                               from admin-on-behalf reservations later.
   *
   * Business rules (lead approved, sales assigned, unit visible, unit
   * AVAILABLE, no duplicate active reservation, commission snapshot)
   * are identical to the portal-only behavior — never change a hot
   * financial path between callers.
   */
  async createForActor(input: {
    brokerId: string;
    brokerAgentUserId: string | null;
    actorUserId: string;
    origin: 'BROKER_PORTAL' | 'ADMIN_ON_BEHALF';
    dto: CreatePortalReservationDto;
  }) {
    const { brokerId, brokerAgentUserId, actorUserId, origin, dto } = input;

    // 1) Lead must belong to this broker, be APPROVED, and have an internal
    //    sales handler — those are hard preconditions per the business rules.
    const lead = await this.prisma.lead.findFirst({
      where: { id: dto.leadId, brokerId },
      select: {
        id: true,
        clientId: true,
        fullName: true,
        phone: true,
        brokerApprovalStatus: true,
        assignedSalesId: true,
        stage: true,
        client: { select: { id: true, active: true, role: true } },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found or not owned by this broker');
    }
    if (lead.brokerApprovalStatus !== 'APPROVED') {
      throw new ConflictException(
        'Lead must be APPROVED by admin before a reservation can be created',
      );
    }
    if (!lead.assignedSalesId) {
      throw new ConflictException(
        'Lead has no assigned internal sales user; ask admin to assign one before creating a reservation',
      );
    }
    if (!lead.client || !lead.client.active) {
      throw new ConflictException(
        'Lead client is missing or inactive — contact admin',
      );
    }

    // 2) Unit must exist, be visible to this broker, and be AVAILABLE.
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: {
        id: true,
        code: true,
        status: true,
        price: true,
        building: {
          select: { phase: { select: { projectId: true } } },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    const projectId = unit.building.phase.projectId;
    await this.assertUnitVisible(brokerId, dto.unitId, projectId);
    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new ConflictException('Unit is not available for reservation');
    }

    // 3) No active reservation already on this unit.
    const activeOnUnit = await this.prisma.reservation.findFirst({
      where: { unitId: dto.unitId, status: { in: ACTIVE_RESERVATION_STATUSES } },
      select: { id: true, reservationNumber: true },
    });
    if (activeOnUnit) {
      throw new ConflictException(
        `Unit already has an active reservation (${activeOnUnit.reservationNumber ?? activeOnUnit.id})`,
      );
    }

    // 4) Idempotency: same broker can't have two active reservations for
    //    the same (lead, unit) pair.
    const dupForLeadUnit = await this.prisma.reservation.findFirst({
      where: {
        brokerId,
        leadId: lead.id,
        unitId: dto.unitId,
        status: { in: ACTIVE_RESERVATION_STATUSES },
      },
      select: { id: true, reservationNumber: true },
    });
    if (dupForLeadUnit) {
      throw new ConflictException(
        `A reservation for this lead and unit already exists (${dupForLeadUnit.reservationNumber ?? dupForLeadUnit.id})`,
      );
    }

    // 5) Resolve installment plan + duration snapshot (reuses public helpers
    //    on the existing service — no duplication of validation logic).
    let bookingAmount = new Prisma.Decimal(0);
    let snapshot: {
      downPaymentAmount: Prisma.Decimal | null;
      remainingAmount: Prisma.Decimal | null;
      financedAmount: Prisma.Decimal | null;
      monthlyInstallment: Prisma.Decimal | null;
      totalPayable: Prisma.Decimal | null;
      finalPaymentAmount: Prisma.Decimal | null;
      durationMonths: number | null;
      increasePercentage: Prisma.Decimal | null;
    } = {
      downPaymentAmount: null,
      remainingAmount: null,
      financedAmount: null,
      monthlyInstallment: null,
      totalPayable: null,
      finalPaymentAmount: null,
      durationMonths: null,
      increasePercentage: null,
    };

    // A broker reservation MUST carry a booking amount derived from an
    // admin-controlled active installment plan. We never trust a client
    // amount and never default to zero.
    //   - explicit installmentPlanTemplateId  → validate & use it
    //   - exactly one applicable active plan   → auto-select it
    //   - multiple applicable plans            → require the broker to choose
    //   - none                                 → block with a clear message
    const applicablePlans = await this.listApplicablePlans(dto.unitId, projectId);
    let resolvedPlanId = dto.installmentPlanTemplateId;
    if (!resolvedPlanId) {
      if (applicablePlans.length === 0) {
        throw new BadRequestException(
          'لا توجد خطة دفع فعّالة لهذه الوحدة. تواصل مع الإدارة قبل إنشاء الحجز.',
        );
      }
      if (applicablePlans.length > 1) {
        throw new BadRequestException(
          'يوجد أكثر من خطة دفع فعّالة لهذه الوحدة. اختر خطة دفع قبل إنشاء الحجز.',
        );
      }
      resolvedPlanId = applicablePlans[0]!.id;
    }

    {
      const plan = await this.reservations.validateBookingPlan(
        resolvedPlanId,
        dto.unitId,
        projectId,
      );
      if (plan.reservationAmount.lte(0)) {
        throw new BadRequestException(
          'مبلغ الحجز لخطة الدفع غير صالح. تواصل مع الإدارة قبل إنشاء الحجز.',
        );
      }
      bookingAmount = plan.reservationAmount;
      snapshot.downPaymentAmount = plan.downPaymentAmount;
      snapshot.finalPaymentAmount = plan.finalPaymentAmount;

      if (plan.durationOptions.length > 0) {
        if (!dto.selectedDurationOptionId) {
          throw new BadRequestException(
            'selectedDurationOptionId is required for this installment plan',
          );
        }
        const option = plan.durationOptions.find(
          (o) => o.id === dto.selectedDurationOptionId,
        );
        if (!option) {
          throw new BadRequestException(
            'selectedDurationOptionId does not belong to this plan',
          );
        }
        const calc = computeDurationOption({
          netPrice: Number(plan.netPrice),
          reservationAmount: Number(plan.reservationAmount),
          downPaymentAmount: Number(plan.downPaymentAmount),
          durationMonths: option.durationMonths,
          increasePercentage: Number(option.increasePercentage),
        });
        snapshot.remainingAmount = new Prisma.Decimal(calc.remainingAmount);
        snapshot.financedAmount = new Prisma.Decimal(calc.financedAmount);
        snapshot.monthlyInstallment = new Prisma.Decimal(calc.monthlyInstallment);
        snapshot.totalPayable = new Prisma.Decimal(calc.totalPayable);
        snapshot.durationMonths = option.durationMonths;
        snapshot.increasePercentage = option.increasePercentage;
      }
    }

    // 6) Commission snapshot — lock at create time. Priority:
    //    project-level commissionPct → broker.defaultCommissionPct.
    //    For FIXED_PER_UNIT model, lock the fixed amount and leave pct null.
    const commission = await this.computeCommissionSnapshot({
      brokerId,
      projectId,
      basisAmount: snapshot.totalPayable ?? new Prisma.Decimal(unit.price),
    });

    const expiresAt = new Date(
      Date.now() + (dto.expiresInHours ?? 72) * 3_600_000,
    );

    // 7) Transactional write: reservation + unit status + history + activities.
    const reservationNumber = await this.reservations.nextReservationNumber();

    const reservation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          reservationNumber,
          unitId: dto.unitId,
          salesId: lead.assignedSalesId!,
          leadId: lead.id,
          clientId: lead.clientId,
          status: ReservationStatus.PENDING,
          notes: dto.notes ?? null,
          expiresAt,
          bookingAmount,
          bookingPaymentStatus: ReservationBookingPaymentStatus.UNPAID,
          // Broker attribution + commission snapshot.
          brokerId,
          brokerAgentId: brokerAgentUserId,
          commissionLockedPct: commission.lockedPct,
          commissionLockedAmount: commission.lockedAmount,
          // Plan + duration snapshot. resolvedPlanId is always set now — a
          // reservation cannot be created without a booking plan.
          installmentPlanTemplateId: resolvedPlanId,
          selectedDurationOptionId: dto.selectedDurationOptionId ?? null,
          selectedDurationMonths: snapshot.durationMonths,
          selectedIncreasePercentage: snapshot.increasePercentage,
          snapshotDownPaymentAmount: snapshot.downPaymentAmount,
          snapshotRemainingAmount: snapshot.remainingAmount,
          snapshotFinancedAmount: snapshot.financedAmount,
          snapshotMonthlyInstallment: snapshot.monthlyInstallment,
          snapshotTotalPayable: snapshot.totalPayable,
          snapshotFinalPaymentAmount: snapshot.finalPaymentAmount,
        },
        include: PORTAL_RESERVATION_INCLUDE,
      });

      // Mark the unit RESERVED + history row so internal CRM stays consistent.
      await tx.unit.update({
        where: { id: dto.unitId },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: expiresAt },
      });
      await tx.unitStatusHistory.create({
        data: {
          unitId: dto.unitId,
          oldStatus: UnitStatus.AVAILABLE,
          newStatus: UnitStatus.RESERVED,
          changedById: actorUserId,
          reason: `Broker reservation ${reservationNumber}`,
        },
      });

      // Reservation timeline (CREATED) — same convention as internal flow.
      await tx.reservationActivity.create({
        data: {
          reservationId: created.id,
          type: ReservationActivityType.CREATED,
          actorId: actorUserId,
          note:
            origin === 'ADMIN_ON_BEHALF'
              ? 'Created by admin on behalf of broker'
              : 'Created via broker portal',
        },
      });

      // Lead activity (feeds the broker portal /portal/activity timeline).
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          type: 'broker_reservation_created',
          payload: {
            origin,
            brokerId,
            brokerAgentId: brokerAgentUserId,
            reservationId: created.id,
            reservationNumber,
            unitId: dto.unitId,
            unitCode: unit.code,
            projectId,
            salesId: lead.assignedSalesId,
            commissionLockedPct:
              commission.lockedPct !== null
                ? commission.lockedPct.toString()
                : null,
            commissionLockedAmount: commission.lockedAmount.toString(),
          },
        },
      });

      // Bump lead stage to NEGOTIATION if currently in early states — mirrors
      // the internal create flow's behavior.
      if (
        lead.stage === 'NEW' ||
        lead.stage === 'INTERESTED' ||
        lead.stage === 'VISIT'
      ) {
        await tx.lead.update({
          where: { id: lead.id },
          data: { stage: 'NEGOTIATION' },
        });
      }

      return created;
    });

    // 8) Notifications — best-effort, never blocks the action.
    await this.notify(reservation.id, {
      brokerId,
      brokerAgentUserId,
      salesUserId: lead.assignedSalesId,
      reservationNumber: reservation.reservationNumber,
      unitCode: unit.code,
      leadName: lead.fullName,
    });

    return reservation;
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  /**
   * Applicable active installment plans for a unit: a unit-specific plan, or a
   * project-wide plan (unitId = null) for the unit's project, with a positive
   * reservation amount. Unit-specific plans are returned first. This is the
   * single source of truth for a reservation's booking amount.
   */
  private async listApplicablePlans(unitId: string, projectId: string) {
    const plans = await this.prisma.installmentPlanTemplate.findMany({
      where: {
        status: PlanTemplateStatus.ACTIVE,
        projectId,
        reservationAmount: { gt: 0 },
        OR: [{ unitId }, { unitId: null }],
      },
      select: {
        id: true,
        name: true,
        unitId: true,
        reservationAmount: true,
        downPaymentAmount: true,
        durationOptions: {
          select: { id: true, durationMonths: true, increasePercentage: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    // Unit-specific plans take precedence over project-wide ones.
    return plans.sort((a, b) => {
      if (a.unitId && !b.unitId) return -1;
      if (!a.unitId && b.unitId) return 1;
      return 0;
    });
  }

  /**
   * Read endpoint backing the broker reservation form: returns the active
   * booking plans the broker may use for a unit so the booking amount is shown
   * before submission. Reuses the same visibility check as create().
   */
  async listBookingPlansForUnit(scope: BrokerScopeContext, unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        building: { select: { phase: { select: { projectId: true } } } },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    const projectId = unit.building.phase.projectId;
    await this.assertUnitVisible(scope.brokerId, unitId, projectId);

    const plans = await this.listApplicablePlans(unitId, projectId);
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      reservationAmount: p.reservationAmount.toString(),
      downPaymentAmount: p.downPaymentAmount.toString(),
      durationOptions: p.durationOptions.map((o) => ({
        id: o.id,
        durationMonths: o.durationMonths,
        increasePercentage: o.increasePercentage.toString(),
      })),
    }));
  }

  private async assertUnitVisible(
    brokerId: string,
    unitId: string,
    projectId: string,
  ): Promise<void> {
    const [projectAccess, unitAccess] = await Promise.all([
      this.prisma.brokerProjectAccess.findFirst({
        where: { brokerId, projectId, active: true },
        select: { id: true },
      }),
      this.prisma.brokerUnitAccess.findFirst({
        where: { brokerId, unitId, active: true },
        select: { id: true },
      }),
    ]);
    if (!projectAccess && !unitAccess) {
      throw new ForbiddenException('Unit is not accessible to this broker');
    }
  }

  private async computeCommissionSnapshot(params: {
    brokerId: string;
    projectId: string;
    basisAmount: Prisma.Decimal;
  }): Promise<{
    lockedPct: Prisma.Decimal | null;
    lockedAmount: Prisma.Decimal;
  }> {
    const [broker, projectAccess] = await Promise.all([
      this.prisma.broker.findUnique({
        where: { id: params.brokerId },
        select: { defaultCommissionPct: true, commissionModel: true },
      }),
      this.prisma.brokerProjectAccess.findFirst({
        where: {
          brokerId: params.brokerId,
          projectId: params.projectId,
          active: true,
        },
        select: { commissionPct: true, fixedAmountPerUnit: true },
      }),
    ]);

    const model = broker?.commissionModel ?? 'PERCENT_OF_SALE';

    if (model === 'FIXED_PER_UNIT') {
      // For fixed-per-unit deals we use the project-access override; if not
      // set, fall back to 0 (admin should configure it explicitly).
      const fixed = projectAccess?.fixedAmountPerUnit ?? new Prisma.Decimal(0);
      return { lockedPct: null, lockedAmount: fixed };
    }

    // PERCENT_OF_SALE (and TIERED treated as percent-of-sale for now).
    const pct =
      projectAccess?.commissionPct ??
      broker?.defaultCommissionPct ??
      new Prisma.Decimal(0);
    const amount = params.basisAmount.mul(pct).div(100);
    return { lockedPct: pct, lockedAmount: amount };
  }

  private async notify(
    reservationId: string,
    info: {
      brokerId: string;
      brokerAgentUserId: string | null;
      salesUserId: string | null;
      reservationNumber: string | null;
      unitCode: string;
      leadName: string;
    },
  ): Promise<void> {
    try {
      const recipients = await this.prisma.brokerUser.findMany({
        where: { brokerId: info.brokerId, status: 'ACTIVE' },
        select: { userId: true },
      });
      const userIds = new Set<string>(recipients.map((r) => r.userId));
      if (info.salesUserId) userIds.add(info.salesUserId);
      if (userIds.size === 0) return;

      const payload = {
        reservationId,
        reservationNumber: info.reservationNumber,
        unitCode: info.unitCode,
        leadName: info.leadName,
        brokerAgentId: info.brokerAgentUserId,
      };

      await this.prisma.notification.createMany({
        data: Array.from(userIds).map((userId) => ({
          userId,
          templateCode: 'broker_reservation_created',
          payload: payload as Prisma.InputJsonValue,
          channel: NotificationChannel.IN_APP,
          sentAt: new Date(),
        })),
      });
    } catch (e) {
      this.logger.warn(
        `notify(reservation ${reservationId}) failed: ${(e as Error).message}`,
      );
    }
  }
}
