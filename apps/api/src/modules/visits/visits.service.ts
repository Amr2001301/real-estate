import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  LeadStage,
  Prisma,
  UserRole,
  VisitActivityType,
  VisitRequestStatus,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { managerScopeIds, SALES_ACTOR_ROLES } from '../../common/utils/sales-scope';
import { matchOrCreateLeadForClient } from '../crm/crm-lead-matching';
import { NotificationsService } from '../notifications/notifications.module';
import { resolveTenantUser } from '../../common/tenant/resolve-tenant-entity';
import {
  AssignSalesDto,
  CreateDirectAppointmentDto,
  CustomerRequestRescheduleDto,
  CustomerVisitFeedbackDto,
  ListAppointmentsDto,
  ListRequestsDto,
  RescheduleVisitDto,
  SalesVisitFeedbackDto,
  ScheduleVisitDto,
  UpdateAppointmentStatusDto,
  UpdateRequestStatusDto,
} from './dto/visits.dto';
import { VisitRequestSource } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// Statuses that are final — no further edits allowed
const FINAL_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.RESCHEDULED,
];

const REQUEST_INCLUDE = {
  user: { select: { id: true, fullName: true, phone: true, email: true } },
  lead: { select: { id: true, fullName: true, phone: true, email: true, stage: true } },
  project: { select: { id: true, name: true } },
  unit: { select: { id: true, code: true, type: true } },
  appointments: {
    select: {
      id: true,
      visitNumber: true,
      scheduledAt: true,
      status: true,
      assignedSales: { select: { id: true, fullName: true } },
    },
    orderBy: { scheduledAt: 'desc' as const },
  },
} satisfies Prisma.VisitRequestInclude;

const APPOINTMENT_INCLUDE = {
  visitRequest: { select: { id: true, requestNumber: true, customerName: true, customerPhone: true, requestStatus: true } },
  lead: { select: { id: true, fullName: true, phone: true, stage: true } },
  client: { select: { id: true, fullName: true, phone: true, email: true } },
  project: { select: { id: true, name: true } },
  unit: { select: { id: true, code: true, type: true } },
  assignedSales: { select: { id: true, fullName: true, phone: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.VisitAppointmentInclude;

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Notification helpers (P3) ───────────────────────────────────────────
  // Every wire below is via NotificationsService — DB row is always created;
  // push is best-effort inside `send`; helper methods (sendToUser/-Users/-Roles)
  // never throw past the caller. Composing the payload also can't crash the
  // business action: any failure here is logged and the notification is
  // simply skipped.

  /**
   * Safe payload shared by every visit-lifecycle notification. Project name is
   * resolved from the translatable JSON column with locale fallback; missing
   * pieces default to ''. Pulled from a single appointment id so call sites
   * stay tiny and uniform.
   *
   * No sensitive data: phone numbers, emails, addresses, reservation amounts
   * and internal ids beyond `visitId` / `requestId` are intentionally excluded.
   */
  private async buildAppointmentPayload(
    appointmentId: string,
    extras: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    try {
      const a = await this.prisma.visitAppointment.findUnique({
        where: { id: appointmentId },
        select: {
          id: true,
          scheduledAt: true,
          visitRequestId: true,
          project: { select: { name: true } },
          unit: { select: { code: true } },
          visitRequest: {
            select: {
              customerName: true,
              preferredDate: true,
              preferredTime: true,
            },
          },
          client: { select: { fullName: true } },
          assignedSales: { select: { fullName: true } },
        },
      });
      if (!a) return { visitId: appointmentId, ...extras };
      const name = (a.project?.name ?? {}) as { ar?: string; en?: string };
      return {
        visitId: a.id,
        requestId: a.visitRequestId ?? '',
        customerName: a.client?.fullName ?? a.visitRequest?.customerName ?? '',
        projectName: name.ar || name.en || '',
        unitCode: a.unit?.code ?? '',
        scheduledAt: a.scheduledAt.toISOString(),
        preferredDate: a.visitRequest?.preferredDate?.toISOString() ?? '',
        preferredTime: a.visitRequest?.preferredTime ?? '',
        salesName: a.assignedSales?.fullName ?? '',
        ...extras,
      };
    } catch {
      return { visitId: appointmentId, ...extras };
    }
  }

  /** Customer id resolved from the appointment's clientId or its parent
   *  visit-request's userId. Returns null when neither is present (walk-in
   *  visits created by sales for an off-platform customer). */
  private async resolveCustomerUserId(
    appointmentId: string,
  ): Promise<string | null> {
    try {
      const a = await this.prisma.visitAppointment.findUnique({
        where: { id: appointmentId },
        select: {
          clientId: true,
          visitRequest: { select: { userId: true } },
        },
      });
      return a?.clientId ?? a?.visitRequest?.userId ?? null;
    } catch {
      return null;
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async stats(user: AuthUser) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86_400_000);

    // SALES → own appointments; SALES_MANAGER → their team (empty team ⇒ none).
    const salesFilter =
      user.role === UserRole.SALES
        ? { assignedSalesId: user.sub }
        : user.role === UserRole.SALES_MANAGER
          ? { assignedSalesId: { in: await managerScopeIds(this.prisma, user.sub) } }
          : {};

    const [newRequests, totalRequests, todayVisits, weekVisits, scheduledVisits, pendingConfirmation] =
      await this.prisma.$transaction([
        this.prisma.visitRequest.count({
          where: {
            OR: [
              { requestStatus: VisitRequestStatus.NEW },
              { requestStatus: VisitRequestStatus.UNDER_REVIEW },
              { requestStatus: null },
            ],
          },
        }),
        this.prisma.visitRequest.count({}),
        this.prisma.visitAppointment.count({
          where: {
            ...salesFilter,
            scheduledAt: { gte: todayStart, lt: todayEnd },
            status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          },
        }),
        this.prisma.visitAppointment.count({
          where: {
            ...salesFilter,
            scheduledAt: { gte: todayStart, lt: weekEnd },
            status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          },
        }),
        this.prisma.visitAppointment.count({
          where: {
            ...salesFilter,
            status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          },
        }),
        this.prisma.visitAppointment.count({
          where: { ...salesFilter, status: AppointmentStatus.SCHEDULED },
        }),
      ]);

    return { newRequests, totalRequests, todayVisits, weekVisits, scheduledVisits, pendingConfirmation };
  }

  // ─── Visit Requests ───────────────────────────────────────────────────────

  async listRequests(dto: ListRequestsDto, user: AuthUser) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const where: Prisma.VisitRequestWhereInput = {
      ...(dto.status ? { requestStatus: dto.status } : {}),
      ...(dto.source ? { source: dto.source } : {}),
      ...(dto.projectId ? { projectId: dto.projectId } : {}),
      ...(dto.leadId ? { leadId: dto.leadId } : {}),
      ...(dto.dateFrom || dto.dateTo
        ? {
            preferredDate: {
              ...(dto.dateFrom ? { gte: new Date(dto.dateFrom) } : {}),
              ...(dto.dateTo ? { lte: new Date(dto.dateTo) } : {}),
            },
          }
        : {}),
      ...(dto.q
        ? {
            OR: [
              { customerName: { contains: dto.q, mode: 'insensitive' } },
              { customerPhone: { contains: dto.q } },
              { user: { fullName: { contains: dto.q, mode: 'insensitive' } } },
              { user: { phone: { contains: dto.q } } },
            ],
          }
        : {}),
    };

    // SALES can only see requests linked to their appointments; SALES_MANAGER
    // sees requests linked to their team's appointments (empty team ⇒ none).
    if (user.role === UserRole.SALES) {
      where.appointments = { some: { assignedSalesId: user.sub } };
    } else if (user.role === UserRole.SALES_MANAGER) {
      where.appointments = {
        some: { assignedSalesId: { in: await managerScopeIds(this.prisma, user.sub) } },
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.visitRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...takeSkip({ page, pageSize }),
      }),
      this.prisma.visitRequest.count({ where }),
    ]);

    return paginate(data, total, { page, pageSize });
  }

  async getRequest(id: string, user: AuthUser) {
    const req = await this.prisma.visitRequest.findUnique({
      where: { id },
      include: {
        ...REQUEST_INCLUDE,
        visitActivities: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, fullName: true, role: true } } } },
      },
    });
    if (!req) throw new NotFoundException('Visit request not found');

    if (user.role === UserRole.SALES) {
      const hasAccess = req.appointments.some((a) => a.assignedSales?.id === user.sub);
      if (!hasAccess) throw new ForbiddenException();
    }

    return req;
  }

  async updateRequest(id: string, dto: UpdateRequestStatusDto, user: AuthUser) {
    const req = await this.prisma.visitRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Visit request not found');

    const now = new Date();
    const timestamps: Partial<{ rejectedAt: Date; cancelledAt: Date }> = {};
    if (dto.status === VisitRequestStatus.REJECTED) timestamps.rejectedAt = now;
    if (dto.status === VisitRequestStatus.CANCELLED) timestamps.cancelledAt = now;

    const [updated] = await this.prisma.$transaction([
      this.prisma.visitRequest.update({
        where: { id },
        data: {
          requestStatus: dto.status,
          adminNotes: dto.adminNotes ?? req.adminNotes,
          ...timestamps,
        },
        include: REQUEST_INCLUDE,
      }),
      this.prisma.visitActivity.create({
        data: {
          visitRequestId: id,
          leadId: req.leadId,
          actorId: user.sub,
          actorRole: user.role,
          type: dto.status === VisitRequestStatus.REJECTED
            ? VisitActivityType.REQUEST_REJECTED
            : dto.status === VisitRequestStatus.CANCELLED
              ? VisitActivityType.REQUEST_CANCELLED
              : VisitActivityType.REQUEST_REVIEWED,
          oldValue: { status: req.requestStatus },
          newValue: { status: dto.status },
          note: dto.adminNotes,
        },
      }),
    ]);

    return updated;
  }

  // ─── Schedule Visit ────────────────────────────────────────────────────────

  async scheduleVisit(requestId: string, dto: ScheduleVisitDto, user: AuthUser) {
    const req = await this.prisma.visitRequest.findUnique({
      where: { id: requestId },
      include: { lead: { select: { id: true } } },
    });
    if (!req) throw new NotFoundException('Visit request not found');

    const visitNumber = await this.nextVisitNumber();

    return this.prisma.$transaction(async (tx) => {
      // XOR ownership: if the request is lead-linked, the appointment carries leadId only.
      // If portal-submitted (userId), it carries clientId only.
      const appointment = await tx.visitAppointment.create({
        data: {
          visitNumber,
          visitRequestId: requestId,
          leadId: req.leadId ?? null,
          clientId: req.leadId ? null : (req.userId ?? null),
          projectId: dto.projectId ?? req.projectId,
          unitId: dto.unitId ?? req.unitId ?? null,
          assignedSalesId: dto.assignedSalesId ?? null,
          scheduledAt: new Date(dto.scheduledAt),
          durationMinutes: dto.durationMinutes ?? null,
          location: dto.location ?? null,
          meetingPoint: dto.meetingPoint ?? null,
          salesNotes: dto.salesNotes ?? null,
          createdById: user.sub,
          updatedById: user.sub,
        },
        include: APPOINTMENT_INCLUDE,
      });

      await tx.visitRequest.update({
        where: { id: requestId },
        data: {
          requestStatus: VisitRequestStatus.CONVERTED,
          convertedAt: new Date(),
        },
      });

      await tx.visitActivity.create({
        data: {
          visitRequestId: requestId,
          visitId: appointment.id,
          leadId: req.leadId,
          actorId: user.sub,
          actorRole: user.role,
          type: VisitActivityType.VISIT_SCHEDULED,
          newValue: { visitNumber, scheduledAt: dto.scheduledAt },
        },
      });

      if (req.leadId) {
        const salesName = dto.assignedSalesId
          ? (await resolveTenantUser(tx, dto.assignedSalesId, { fullName: true }, { throwBadRequest: true }).catch(() => null))?.fullName
          : null;

        // Advance lead to VISIT stage if still in an early stage
        await tx.lead.updateMany({
          where: {
            id: req.leadId,
            stage: { in: [LeadStage.NEW, LeadStage.INTERESTED] },
          },
          data: { stage: LeadStage.VISIT },
        });

        await tx.leadActivity.create({
          data: {
            leadId: req.leadId,
            type: 'visit',
            payload: {
              visitId: appointment.id,
              visitNumber,
              status: AppointmentStatus.SCHEDULED,
              scheduledAt: dto.scheduledAt,
              salesName: salesName ?? null,
            },
          },
        });
      }

      return appointment;
    }).then(async (appointment) => {
      // P3 — event B: notify customer + assigned sales AFTER the schedule
      // commits. Side-effects intentionally outside the transaction so a
      // notification failure can never roll it back, and the helpers
      // themselves never throw.
      const customerId = await this.resolveCustomerUserId(appointment.id);
      const payload = await this.buildAppointmentPayload(appointment.id);
      await this.notifications.sendToUsers(
        [customerId, dto.assignedSalesId ?? null],
        'visit_scheduled',
        payload,
      );
      return appointment;
    });
  }

  // ─── Create Direct Appointment (walk-in / sales-initiated) ────────────────

  async createDirectAppointment(dto: CreateDirectAppointmentDto, user: AuthUser) {
    if (dto.leadId && dto.clientId) {
      throw new BadRequestException('لا يمكن تحديد عميل محتمل وعميل مسجل معًا');
    }

    const customerName = dto.customerName?.trim() || null;
    const customerPhone = dto.customerPhone?.trim() || null;
    const isWalkin = !dto.leadId && !dto.clientId;
    if (isWalkin && (!customerName || !customerPhone)) {
      throw new BadRequestException(
        'يجب إدخال اسم العميل ورقم الهاتف في حالة الزيارة بدون حساب مسجل',
      );
    }

    let resolvedLeadId: string | null = null;
    let resolvedClientId: string | null = null;
    let clientFullName = '';
    let clientPhone: string | null = null;
    let clientEmail: string | null = null;
    let derivedName = customerName;
    let derivedPhone = customerPhone;

    if (dto.clientId) {
      const c = await resolveTenantUser(
        this.prisma,
        dto.clientId,
        { id: true, role: true, active: true, fullName: true, phone: true, email: true },
        {
          expectRoles: [UserRole.CLIENT, UserRole.CUSTOMER],
          label: 'Client not found',
          throwBadRequest: true,
        },
      );
      if (!c.active) throw new BadRequestException('Selected client is inactive');
      resolvedClientId = c.id;
      clientFullName = c.fullName;
      clientPhone = c.phone;
      clientEmail = c.email ?? null;
      derivedName = customerName ?? c.fullName;
      derivedPhone = customerPhone ?? c.phone;
    } else if (dto.leadId) {
      const l = await this.prisma.lead.findUnique({
        where: { id: dto.leadId },
        select: { id: true, clientId: true, fullName: true, phone: true },
      });
      if (!l) throw new BadRequestException('Lead not found');
      resolvedLeadId = l.id;
      derivedName = customerName ?? l.fullName;
      derivedPhone = customerPhone ?? l.phone;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true },
    });
    if (!project) throw new BadRequestException('Project not found');

    if (dto.unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: dto.unitId },
        select: { id: true, building: { select: { phase: { select: { projectId: true } } } } },
      });
      if (!unit) throw new BadRequestException('Unit not found');
      if (unit.building.phase.projectId !== dto.projectId) {
        throw new BadRequestException('الوحدة لا تنتمي إلى المشروع المختار');
      }
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduled date');
    }
    const isPast = scheduledAt < new Date();
    if (isPast && user.role !== UserRole.ADMIN) {
      throw new BadRequestException('لا يمكن جدولة زيارة في الماضي');
    }
    if (isPast && dto.status !== AppointmentStatus.COMPLETED) {
      throw new BadRequestException(
        'الزيارة في تاريخ ماضٍ يجب حفظها كمنفّذة (COMPLETED)',
      );
    }

    let effectiveSalesId: string | null = null;
    if (user.role === UserRole.SALES) {
      effectiveSalesId = user.sub;
    } else if (dto.assignedSalesId) {
      effectiveSalesId = await this.resolveAssignableSalesId(dto.assignedSalesId, user);
    }

    const initialStatus =
      dto.status === AppointmentStatus.COMPLETED
        ? AppointmentStatus.COMPLETED
        : AppointmentStatus.SCHEDULED;

    return this.withUniqueRetry(async () => {
      const visitNumber = await this.nextVisitNumber();
      const requestNumber = await this.nextRequestNumber();

      return this.prisma.$transaction(async (tx) => {
        const visitRequest = await tx.visitRequest.create({
          data: {
            requestNumber,
            projectId: dto.projectId,
            unitId: dto.unitId ?? null,
            leadId: resolvedLeadId,
            userId: resolvedClientId,
            customerName: derivedName,
            customerPhone: derivedPhone,
            preferredDate: scheduledAt,
            source: VisitRequestSource.SALES,
            requestStatus: VisitRequestStatus.CONVERTED,
            convertedAt: new Date(),
            assignedSalesId: effectiveSalesId,
          },
        });

        const appointment = await tx.visitAppointment.create({
          data: {
            visitNumber,
            visitRequestId: visitRequest.id,
            leadId: resolvedLeadId,
            clientId: resolvedClientId,
            projectId: dto.projectId,
            unitId: dto.unitId ?? null,
            assignedSalesId: effectiveSalesId,
            scheduledAt,
            durationMinutes: dto.durationMinutes ?? null,
            location: dto.location ?? null,
            meetingPoint: dto.meetingPoint ?? null,
            salesNotes: dto.salesNotes ?? null,
            status: initialStatus,
            completedAt:
              initialStatus === AppointmentStatus.COMPLETED ? scheduledAt : null,
            createdById: user.sub,
            updatedById: user.sub,
          },
          include: APPOINTMENT_INCLUDE,
        });

      await tx.visitActivity.create({
        data: {
          visitRequestId: visitRequest.id,
          visitId: appointment.id,
          leadId: resolvedLeadId,
          actorId: user.sub,
          actorRole: user.role,
          type:
            initialStatus === AppointmentStatus.COMPLETED
              ? VisitActivityType.VISIT_COMPLETED
              : VisitActivityType.VISIT_SCHEDULED,
          newValue: {
            visitNumber,
            scheduledAt: scheduledAt.toISOString(),
            status: initialStatus,
          },
        },
      });

      if (resolvedLeadId) {
        await tx.lead.updateMany({
          where: {
            id: resolvedLeadId,
            stage: { in: [LeadStage.NEW, LeadStage.INTERESTED] },
          },
          data: { stage: LeadStage.VISIT },
        });

        await tx.leadActivity.create({
          data: {
            leadId: resolvedLeadId,
            type: 'visit',
            payload: {
              visitId: appointment.id,
              visitNumber,
              status: initialStatus,
              scheduledAt: scheduledAt.toISOString(),
            },
          },
        });
      } else if (resolvedClientId) {
        const { leadId: targetLeadId } = await matchOrCreateLeadForClient(tx, {
          clientId: resolvedClientId,
          projectId: dto.projectId,
          unitId: dto.unitId ?? null,
          bumpableStages: [LeadStage.NEW, LeadStage.INTERESTED],
          targetStage: LeadStage.VISIT,
          clientFullName,
          clientPhone: clientPhone ?? '',
          clientEmail,
          assignedSalesId: effectiveSalesId,
        });
        await tx.leadActivity.create({
          data: {
            leadId: targetLeadId,
            type: 'visit',
            payload: {
              visitId: appointment.id,
              visitNumber,
              status: initialStatus,
              scheduledAt: scheduledAt.toISOString(),
            },
          },
        });
      }

        return appointment;
      });
    });
  }

  private async withUniqueRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        const isUniqueConflict =
          e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
        if (!isUniqueConflict) throw e;
        lastError = e;
      }
    }
    throw lastError;
  }

  private async nextRequestNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.visitRequest.count();
    return `VR-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  // ─── Appointments ─────────────────────────────────────────────────────────

  async listAppointments(dto: ListAppointmentsDto, user: AuthUser) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const todayStart = dto.today
      ? (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })()
      : undefined;
    const todayEnd = todayStart ? new Date(todayStart.getTime() + 86_400_000) : undefined;

    const where: Prisma.VisitAppointmentWhereInput = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.projectId ? { projectId: dto.projectId } : {}),
      ...(dto.assignedSalesId ? { assignedSalesId: dto.assignedSalesId } : {}),
      ...(dto.leadId ? { leadId: dto.leadId } : {}),
      ...(dto.clientId ? { clientId: dto.clientId } : {}),
      ...(dto.today
        ? { scheduledAt: { gte: todayStart, lt: todayEnd } }
        : dto.scheduledFrom || dto.scheduledTo
          ? {
              scheduledAt: {
                ...(dto.scheduledFrom ? { gte: new Date(dto.scheduledFrom) } : {}),
                ...(dto.scheduledTo ? { lte: new Date(dto.scheduledTo) } : {}),
              },
            }
          : {}),
      ...(dto.q
        ? {
            OR: [
              { client: { fullName: { contains: dto.q, mode: 'insensitive' } } },
              { client: { phone: { contains: dto.q } } },
              { lead: { fullName: { contains: dto.q, mode: 'insensitive' } } },
              { visitNumber: { contains: dto.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (user.role === UserRole.SALES) {
      where.assignedSalesId = user.sub;
    } else if (user.role === UserRole.SALES_MANAGER) {
      // Manager team scope overrides any requested assignedSalesId. Empty team
      // ⇒ matches nothing (never an all-sales fallback).
      where.assignedSalesId = { in: await managerScopeIds(this.prisma, user.sub) };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.visitAppointment.findMany({
        where,
        include: APPOINTMENT_INCLUDE,
        orderBy: { scheduledAt: 'asc' },
        ...takeSkip({ page, pageSize }),
      }),
      this.prisma.visitAppointment.count({ where }),
    ]);

    return paginate(data, total, { page, pageSize });
  }

  async getAppointment(id: string, user: AuthUser) {
    const appt = await this.prisma.visitAppointment.findUnique({
      where: { id },
      include: {
        ...APPOINTMENT_INCLUDE,
        visitActivities: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { id: true, fullName: true, role: true } } },
        },
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    await this.assertApptInScope(appt, user);

    return appt;
  }

  // Validates an assignment target: must be an active sales actor (SALES or
  // SALES_MANAGER). A SALES_MANAGER may only assign within their own scope
  // (self + team). Returns the validated salesId.
  private async resolveAssignableSalesId(salesId: string, user: AuthUser): Promise<string> {
    const s = await resolveTenantUser(
      this.prisma,
      salesId,
      { id: true, role: true, active: true },
      { label: 'Sales person not found', throwBadRequest: true },
    );
    if (!SALES_ACTOR_ROLES.includes(s.role)) {
      throw new BadRequestException('Selected user is not a sales person');
    }
    if (!s.active) throw new BadRequestException('Selected sales person is inactive');
    if (user.role === UserRole.SALES_MANAGER) {
      const scope = await managerScopeIds(this.prisma, user.sub);
      if (!scope.includes(s.id)) {
        throw new BadRequestException('Selected sales person is not in your team');
      }
    }
    return s.id;
  }

  // Per-record ownership: SALES → own appointments; SALES_MANAGER → own +
  // team appointments. No-op for ADMIN. Throws Forbidden to match visits style.
  private async assertApptInScope(
    appt: { assignedSalesId: string | null },
    user: AuthUser,
  ) {
    if (user.role === UserRole.SALES && appt.assignedSalesId !== user.sub) {
      throw new ForbiddenException();
    }
    if (user.role === UserRole.SALES_MANAGER) {
      const scope = await managerScopeIds(this.prisma, user.sub);
      if (!appt.assignedSalesId || !scope.includes(appt.assignedSalesId)) {
        throw new ForbiddenException();
      }
    }
  }

  async updateAppointmentStatus(id: string, dto: UpdateAppointmentStatusDto, user: AuthUser) {
    const appt = await this.prisma.visitAppointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');

    await this.assertApptInScope(appt, user);

    if (FINAL_STATUSES.includes(appt.status)) {
      throw new BadRequestException(`Cannot update appointment in status: ${appt.status}`);
    }

    const now = new Date();

    // ── Workflow guards (P2) ────────────────────────────────────────────────
    // Two-sided confirmation: a visit may only be COMPLETED after the customer
    // has actively CONFIRMED, unless an ADMIN explicitly opts into a force
    // override (e.g. customer walked in without confirming online). SALES /
    // SALES_MANAGER never get the override — they must wait.
    if (dto.status === AppointmentStatus.COMPLETED) {
      if (appt.status !== AppointmentStatus.CONFIRMED) {
        const allowOverride = dto.force === true && user.role === UserRole.ADMIN;
        if (!allowOverride) {
          throw new BadRequestException(
            'Cannot complete an unconfirmed appointment. The customer must confirm first, or an admin must use the explicit override.',
          );
        }
      }
    }
    // NO_SHOW can only be marked after the scheduled time has passed —
    // prevents pre-emptively stamping a no-show before the visit was due.
    if (dto.status === AppointmentStatus.NO_SHOW) {
      if (appt.scheduledAt.getTime() > now.getTime()) {
        throw new BadRequestException(
          'Cannot mark a no-show before the scheduled visit time.',
        );
      }
    }

    const timestamps: Record<string, Date> = {};
    if (dto.status === AppointmentStatus.CONFIRMED) timestamps.confirmedAt = now;
    if (dto.status === AppointmentStatus.COMPLETED) timestamps.completedAt = now;
    if (dto.status === AppointmentStatus.CANCELLED) timestamps.cancelledAt = now;
    if (dto.status === AppointmentStatus.NO_SHOW) timestamps.noShowAt = now;

    const activityType: Record<string, VisitActivityType> = {
      [AppointmentStatus.CONFIRMED]: VisitActivityType.VISIT_CONFIRMED,
      [AppointmentStatus.COMPLETED]: VisitActivityType.VISIT_COMPLETED,
      [AppointmentStatus.CANCELLED]: VisitActivityType.VISIT_CANCELLED,
      [AppointmentStatus.NO_SHOW]: VisitActivityType.VISIT_NO_SHOW,
    };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.visitAppointment.update({
        where: { id },
        data: {
          status: dto.status,
          updatedById: user.sub,
          salesNotes: dto.salesNotes ?? appt.salesNotes,
          resultNotes: dto.resultNotes ?? appt.resultNotes,
          cancellationReason: dto.cancellationReason ?? appt.cancellationReason,
          noShowReason: dto.noShowReason ?? appt.noShowReason,
          customerFeedback: dto.customerFeedback ?? appt.customerFeedback,
          ...timestamps,
        },
        include: APPOINTMENT_INCLUDE,
      });

      // When an admin completes an unconfirmed visit, mark the override on
      // the activity so the timeline can render "tabbed as admin override"
      // without trying to parse free text.
      const overrideApplied =
        dto.status === AppointmentStatus.COMPLETED &&
        appt.status !== AppointmentStatus.CONFIRMED &&
        dto.force === true &&
        user.role === UserRole.ADMIN;

      await tx.visitActivity.create({
        data: {
          visitRequestId: appt.visitRequestId,
          visitId: id,
          leadId: appt.leadId,
          actorId: user.sub,
          actorRole: user.role,
          type: activityType[dto.status] ?? VisitActivityType.VISIT_CONFIRMED,
          oldValue: { status: appt.status },
          newValue: overrideApplied
            ? { status: dto.status, override: 'completed_without_customer_confirmation' }
            : { status: dto.status },
          note: dto.salesNotes ?? dto.cancellationReason ?? dto.noShowReason,
        },
      });

      if (appt.leadId) {
        // Advance to VISIT on confirmation if still in an early stage
        if (dto.status === AppointmentStatus.CONFIRMED) {
          await tx.lead.updateMany({
            where: {
              id: appt.leadId,
              stage: { in: [LeadStage.NEW, LeadStage.INTERESTED] },
            },
            data: { stage: LeadStage.VISIT },
          });
        }

        await tx.leadActivity.create({
          data: {
            leadId: appt.leadId,
            type: 'visit',
            payload: {
              visitId: id,
              visitNumber: appt.visitNumber,
              status: dto.status,
              scheduledAt: appt.scheduledAt,
            },
          },
        });
      }

      return updated;
    }).then(async (updated) => {
      // P3 — events D (CONFIRMED) / G (COMPLETED) / H (CANCELLED) / I (NO_SHOW).
      // Side-effects after the tx commits; the helpers never throw.
      const customerId = await this.resolveCustomerUserId(id);
      const payload = await this.buildAppointmentPayload(id);
      switch (dto.status) {
        case AppointmentStatus.CONFIRMED:
          // Admin-side confirmation (e.g., customer walked in). Notify
          // admins + assigned sales (not the customer — they confirmed).
          await this.notifications.sendToRoles(
            [UserRole.ADMIN],
            'visit_customer_confirmed',
            payload,
          );
          await this.notifications.sendToUser(
            appt.assignedSalesId,
            'visit_customer_confirmed',
            payload,
          );
          break;
        case AppointmentStatus.COMPLETED:
          await this.notifications.sendToUser(
            customerId,
            'visit_completed',
            payload,
          );
          // Gap 7 — ask the customer to rate the visit. Deep-link metadata
          // routes the notification to the visits ticket (entityType 'visit'
          // resolves to /account/visits in the customer notification mapper).
          await this.notifications.sendToUser(customerId, 'visit_feedback_requested', {
            ...payload,
            entityType: 'visit',
            entityId: id,
            appointmentId: id,
            action: 'submit_visit_feedback',
          });
          break;
        case AppointmentStatus.CANCELLED:
          await this.notifications.sendToUsers(
            [customerId, appt.assignedSalesId],
            'visit_cancelled',
            payload,
          );
          break;
        case AppointmentStatus.NO_SHOW:
          await this.notifications.sendToUsers(
            [customerId, appt.assignedSalesId],
            'visit_no_show',
            payload,
          );
          break;
      }
      return updated;
    });
  }

  async reschedule(id: string, dto: RescheduleVisitDto, user: AuthUser) {
    const appt = await this.prisma.visitAppointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');

    if (FINAL_STATUSES.includes(appt.status)) {
      throw new BadRequestException(`Cannot reschedule appointment in status: ${appt.status}`);
    }

    const visitNumber = await this.nextVisitNumber();

    return this.prisma.$transaction(async (tx) => {
      await tx.visitAppointment.update({
        where: { id },
        data: { status: AppointmentStatus.RESCHEDULED, updatedById: user.sub },
      });

      const newAppt = await tx.visitAppointment.create({
        data: {
          visitNumber,
          visitRequestId: appt.visitRequestId,
          leadId: appt.leadId,
          clientId: appt.clientId,
          projectId: appt.projectId,
          unitId: appt.unitId,
          assignedSalesId: dto.assignedSalesId ?? appt.assignedSalesId,
          scheduledAt: new Date(dto.scheduledAt),
          durationMinutes: dto.durationMinutes ?? appt.durationMinutes,
          location: dto.location ?? appt.location,
          meetingPoint: dto.meetingPoint ?? appt.meetingPoint,
          salesNotes: dto.salesNotes ?? null,
          createdById: user.sub,
          updatedById: user.sub,
        },
        include: APPOINTMENT_INCLUDE,
      });

      await tx.visitActivity.create({
        data: {
          visitRequestId: appt.visitRequestId,
          visitId: newAppt.id,
          leadId: appt.leadId,
          actorId: user.sub,
          actorRole: user.role,
          type: VisitActivityType.VISIT_RESCHEDULED,
          oldValue: { visitId: id, scheduledAt: appt.scheduledAt },
          newValue: { visitId: newAppt.id, visitNumber, scheduledAt: dto.scheduledAt },
        },
      });

      if (appt.leadId) {
        await tx.leadActivity.create({
          data: {
            leadId: appt.leadId,
            type: 'visit',
            payload: {
              visitId: newAppt.id,
              visitNumber,
              status: AppointmentStatus.SCHEDULED,
              scheduledAt: dto.scheduledAt,
              rescheduledFrom: appt.visitNumber,
            },
          },
        });
      }

      return newAppt;
    }).then(async (newAppt) => {
      // P3 — event F: notify customer + new assigned sales after reschedule
      // commits. Resolved against the NEW appointment because clientId /
      // visitRequest are copied over from the original.
      const customerId = await this.resolveCustomerUserId(newAppt.id);
      const payload = await this.buildAppointmentPayload(newAppt.id);
      await this.notifications.sendToUsers(
        [customerId, newAppt.assignedSalesId],
        'visit_rescheduled',
        payload,
      );
      return newAppt;
    });
  }

  async assignSales(id: string, dto: AssignSalesDto, user: AuthUser) {
    const appt = await this.prisma.visitAppointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');

    if (FINAL_STATUSES.includes(appt.status)) {
      throw new BadRequestException(`Cannot reassign appointment in status: ${appt.status}`);
    }

    const salesUser = await resolveTenantUser(
      this.prisma,
      dto.assignedSalesId,
      { id: true, fullName: true, role: true },
      {
        expectRoles: [UserRole.SALES, UserRole.ADMIN],
        label: 'Assigned user must be a sales representative',
        throwBadRequest: true,
      },
    );

    // SALES_REASSIGNED captures a change from one sales user to another;
    // SALES_ASSIGNED stays for the initial assignment.
    const isReassignment =
      appt.assignedSalesId !== null && appt.assignedSalesId !== dto.assignedSalesId;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.visitAppointment.update({
        where: { id },
        data: { assignedSalesId: dto.assignedSalesId, updatedById: user.sub },
        include: APPOINTMENT_INCLUDE,
      });

      await tx.visitActivity.create({
        data: {
          visitRequestId: appt.visitRequestId,
          visitId: id,
          leadId: appt.leadId,
          actorId: user.sub,
          actorRole: user.role,
          type: isReassignment
            ? VisitActivityType.SALES_REASSIGNED
            : VisitActivityType.SALES_ASSIGNED,
          oldValue: { assignedSalesId: appt.assignedSalesId },
          newValue: { assignedSalesId: dto.assignedSalesId, salesName: salesUser.fullName },
        },
      });

      return updated;
    }).then(async (updated) => {
      // P3 — event C: notify the newly-assigned sales user. The previous
      // assignee is intentionally NOT notified (silent reassignment to avoid
      // confusion). The customer is not notified either — they only learn
      // about staff changes through scheduling-related events.
      const payload = await this.buildAppointmentPayload(id);
      await this.notifications.sendToUser(
        dto.assignedSalesId,
        'visit_sales_assigned',
        payload,
      );
      return updated;
    });
  }

  // ─── Customer-side endpoints (two-sided confirmation, P2) ────────────────

  /**
   * Load an appointment that the given customer is allowed to act on. Ownership
   * matches when either the parent VisitRequest carries the user's id OR the
   * appointment's `clientId` does. Anything else throws NotFound so we don't
   * leak that the appointment exists.
   */
  private async loadAppointmentForCustomer(
    appointmentId: string,
    customerUserId: string,
  ) {
    const appt = await this.prisma.visitAppointment.findUnique({
      where: { id: appointmentId },
      include: { visitRequest: { select: { userId: true } } },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    const owns =
      appt.clientId === customerUserId ||
      appt.visitRequest?.userId === customerUserId;
    if (!owns) throw new NotFoundException('Appointment not found');
    return appt;
  }

  /**
   * Customer confirms a SCHEDULED appointment. Idempotent for already-CONFIRMED
   * rows (returns the current appointment) but rejects any other state so the
   * customer can't override a cancellation or completion.
   */
  async customerConfirmAppointment(appointmentId: string, user: AuthUser) {
    const appt = await this.loadAppointmentForCustomer(appointmentId, user.sub);

    if (appt.status === AppointmentStatus.CONFIRMED) {
      return this.prisma.visitAppointment.findUnique({
        where: { id: appointmentId },
        include: APPOINTMENT_INCLUDE,
      });
    }
    if (appt.status !== AppointmentStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot confirm an appointment in status: ${appt.status}`,
      );
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.visitAppointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CONFIRMED, confirmedAt: now },
        include: APPOINTMENT_INCLUDE,
      });
      await tx.visitActivity.create({
        data: {
          visitRequestId: appt.visitRequestId,
          visitId: appointmentId,
          leadId: appt.leadId,
          actorId: user.sub,
          actorRole: user.role,
          type: VisitActivityType.CUSTOMER_CONFIRMED,
          oldValue: { status: appt.status },
          newValue: { status: AppointmentStatus.CONFIRMED },
        },
      });
      return updated;
    }).then(async (updated) => {
      // P3 — event D: notify admins + assigned sales. The customer who just
      // confirmed is intentionally not notified again.
      const payload = await this.buildAppointmentPayload(appointmentId);
      await this.notifications.sendToRoles(
        [UserRole.ADMIN],
        'visit_customer_confirmed',
        payload,
      );
      await this.notifications.sendToUser(
        appt.assignedSalesId,
        'visit_customer_confirmed',
        payload,
      );
      return updated;
    });
  }

  /**
   * Customer asks to reschedule a SCHEDULED appointment. Stores the optional
   * reason as `customerFeedback` (reused from the existing free-text column)
   * so admins see it on the appointment detail without an extra column. The
   * appointment goes to PENDING_RESCHEDULE; the admin reschedule flow takes it
   * back to SCHEDULED (via the standard reschedule endpoint, which creates a
   * fresh appointment row).
   */
  async customerRequestReschedule(
    appointmentId: string,
    dto: CustomerRequestRescheduleDto,
    user: AuthUser,
  ) {
    const appt = await this.loadAppointmentForCustomer(appointmentId, user.sub);

    if (appt.status === AppointmentStatus.PENDING_RESCHEDULE) {
      // Idempotent: customer hit the button twice — return current row.
      return this.prisma.visitAppointment.findUnique({
        where: { id: appointmentId },
        include: APPOINTMENT_INCLUDE,
      });
    }
    if (appt.status !== AppointmentStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot request reschedule on an appointment in status: ${appt.status}`,
      );
    }

    const reason = dto.reason?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.visitAppointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.PENDING_RESCHEDULE,
          // Mirror the reason into customerFeedback so admin tooling that
          // already renders feedback picks it up; existing feedback is
          // preserved when the customer didn't supply a new reason.
          customerFeedback: reason ?? appt.customerFeedback,
        },
        include: APPOINTMENT_INCLUDE,
      });
      await tx.visitActivity.create({
        data: {
          visitRequestId: appt.visitRequestId,
          visitId: appointmentId,
          leadId: appt.leadId,
          actorId: user.sub,
          actorRole: user.role,
          type: VisitActivityType.CUSTOMER_RESCHEDULE_REQUESTED,
          oldValue: { status: appt.status },
          newValue: { status: AppointmentStatus.PENDING_RESCHEDULE },
          note: reason,
        },
      });
      return updated;
    }).then(async (updated) => {
      // P3 — event E: notify admins + assigned sales. Reason is included in
      // the payload (capped at 500 chars by the DTO) — never logged.
      const payload = await this.buildAppointmentPayload(appointmentId, {
        reason: reason ?? '',
      });
      await this.notifications.sendToRoles(
        [UserRole.ADMIN],
        'visit_customer_reschedule_requested',
        payload,
      );
      await this.notifications.sendToUser(
        appt.assignedSalesId,
        'visit_customer_reschedule_requested',
        payload,
      );
      return updated;
    });
  }

  /**
   * Gap 7 — customer submits a rating + optional comment for a COMPLETED visit.
   * One-time: a second attempt is rejected. Writes the dedicated customer*
   * columns (never the legacy customerFeedback, which is the reschedule reason).
   * Notifies the assigned sales rep best-effort.
   */
  async customerSubmitFeedback(
    appointmentId: string,
    dto: CustomerVisitFeedbackDto,
    user: AuthUser,
  ) {
    const appt = await this.loadAppointmentForCustomer(appointmentId, user.sub);
    if (appt.status !== AppointmentStatus.COMPLETED) {
      throw new BadRequestException('يمكن تقييم الزيارة بعد اكتمالها فقط');
    }
    if (appt.customerRatingSubmittedAt) {
      throw new BadRequestException('تم إرسال تقييمك لهذه الزيارة مسبقاً');
    }

    const comment = dto.comment?.trim() || null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.visitAppointment.update({
        where: { id: appointmentId },
        data: {
          customerRating: dto.rating,
          customerRatingText: comment,
          customerRatingSubmittedAt: new Date(),
        },
        include: APPOINTMENT_INCLUDE,
      });
      await tx.visitActivity.create({
        data: {
          visitRequestId: appt.visitRequestId,
          visitId: appointmentId,
          leadId: appt.leadId,
          actorId: user.sub,
          actorRole: user.role,
          type: VisitActivityType.NOTE_ADDED,
          note: `تقييم العميل: ${dto.rating}/5`,
        },
      });
      return next;
    });

    // Let the assigned sales rep know their visit was rated (best-effort).
    const payload = await this.buildAppointmentPayload(appointmentId, {
      entityType: 'visit',
      entityId: appointmentId,
      appointmentId,
      rating: dto.rating,
    });
    await this.notifications.sendToUser(
      appt.assignedSalesId,
      'visit_feedback_received',
      payload,
    );
    return updated;
  }

  /**
   * Gap 7 — assigned sales / manager / admin records their own feedback on a
   * COMPLETED visit. Updatable (staff may revise their note). Writes the
   * dedicated sales* columns; rejects an entirely empty submission.
   */
  async salesSubmitFeedback(
    appointmentId: string,
    dto: SalesVisitFeedbackDto,
    user: AuthUser,
  ) {
    const appt = await this.prisma.visitAppointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    await this.assertApptInScope(appt, user);
    if (appt.status !== AppointmentStatus.COMPLETED) {
      throw new BadRequestException('يمكن إضافة ملاحظات الزيارة بعد اكتمالها فقط');
    }
    const notes = dto.notes?.trim() || null;
    if (dto.rating == null && !notes) {
      throw new BadRequestException('أدخل تقييماً (1–5) أو ملاحظة على الأقل');
    }

    return this.prisma.$transaction(async (tx) => {
      const next = await tx.visitAppointment.update({
        where: { id: appointmentId },
        data: {
          salesRating: dto.rating ?? appt.salesRating,
          salesRatingText: notes ?? appt.salesRatingText,
          salesRatingSubmittedAt: new Date(),
          updatedById: user.sub,
        },
        include: APPOINTMENT_INCLUDE,
      });
      await tx.visitActivity.create({
        data: {
          visitRequestId: appt.visitRequestId,
          visitId: appointmentId,
          leadId: appt.leadId,
          actorId: user.sub,
          actorRole: user.role,
          type: VisitActivityType.NOTE_ADDED,
          note: dto.rating != null ? `تقييم المندوب: ${dto.rating}/5` : 'ملاحظة المندوب على الزيارة',
        },
      });
      return next;
    });
  }

  /**
   * P3 — event J: visit-day reminder fan-out. Sends a single push/IN_APP
   * notification to the customer and the assigned sales user for an
   * appointment scheduled today. Wired as a service method only — there is
   * **no scheduler** yet, so this is not called automatically.
   *
   * **Scheduler deferred:** the project has no recurring-job infrastructure
   * (BullMQ recurring jobs / a cron worker / an external scheduler) wired
   * for this. When that lands, a daily worker should call this method for
   * every appointment whose `scheduledAt` falls on the current day and
   * whose status is still `SCHEDULED` or `CONFIRMED`. The method itself is
   * idempotent in the sense that re-running it would simply emit another
   * reminder; the scheduler is expected to dedupe at the job layer.
   *
   * No-op (no throw) when:
   *   - the appointment doesn't exist
   *   - it isn't scheduled for today in UTC
   *   - it's in a terminal state
   *
   * Recipient resolution and helpers are the same swallow-errors path used
   * elsewhere, so a bad data row never bubbles up.
   */
  async notifyVisitDayReminder(appointmentId: string): Promise<void> {
    try {
      const a = await this.prisma.visitAppointment.findUnique({
        where: { id: appointmentId },
        select: {
          scheduledAt: true,
          status: true,
          clientId: true,
          assignedSalesId: true,
          visitRequest: { select: { userId: true } },
        },
      });
      if (!a) return;
      if (FINAL_STATUSES.includes(a.status)) return;
      const day = a.scheduledAt;
      const today = new Date();
      const sameDay =
        day.getUTCFullYear() === today.getUTCFullYear() &&
        day.getUTCMonth() === today.getUTCMonth() &&
        day.getUTCDate() === today.getUTCDate();
      if (!sameDay) return;
      const customerId = a.clientId ?? a.visitRequest?.userId ?? null;
      const payload = await this.buildAppointmentPayload(appointmentId);
      await this.notifications.sendToUsers(
        [customerId, a.assignedSalesId],
        'visit_day_reminder',
        payload,
      );
    } catch {
      // Reminder is a best-effort surface; never let it surface failure.
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async nextVisitNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.visitAppointment.count();
    return `VA-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
