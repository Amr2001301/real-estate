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
import { matchOrCreateLeadForClient } from '../crm/crm-lead-matching';
import {
  AssignSalesDto,
  CreateDirectAppointmentDto,
  ListAppointmentsDto,
  ListRequestsDto,
  RescheduleVisitDto,
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
  constructor(private readonly prisma: PrismaService) {}

  // ─── Stats ────────────────────────────────────────────────────────────────

  async stats(user: AuthUser) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86_400_000);

    const salesFilter = user.role === UserRole.SALES ? { assignedSalesId: user.sub } : {};

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

    // SALES can only see requests linked to their appointments
    if (user.role === UserRole.SALES) {
      where.appointments = { some: { assignedSalesId: user.sub } };
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
          ? (await tx.user.findUnique({ where: { id: dto.assignedSalesId }, select: { fullName: true } }))?.fullName
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
      const c = await this.prisma.user.findUnique({
        where: { id: dto.clientId },
        select: { id: true, role: true, active: true, fullName: true, phone: true, email: true },
      });
      if (!c) throw new BadRequestException('Client not found');
      if (c.role !== UserRole.CLIENT && c.role !== UserRole.CUSTOMER) {
        throw new BadRequestException('Selected user is not a client or customer');
      }
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
      const s = await this.prisma.user.findUnique({
        where: { id: dto.assignedSalesId },
        select: { id: true, role: true, active: true, fullName: true },
      });
      if (!s) throw new BadRequestException('Sales person not found');
      if (s.role !== UserRole.SALES) {
        throw new BadRequestException('Selected user is not a sales person');
      }
      if (!s.active) throw new BadRequestException('Selected sales person is inactive');
      effectiveSalesId = s.id;
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

    if (user.role === UserRole.SALES && appt.assignedSalesId !== user.sub) {
      throw new ForbiddenException();
    }

    return appt;
  }

  async updateAppointmentStatus(id: string, dto: UpdateAppointmentStatusDto, user: AuthUser) {
    const appt = await this.prisma.visitAppointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');

    if (user.role === UserRole.SALES && appt.assignedSalesId !== user.sub) {
      throw new ForbiddenException();
    }

    if (FINAL_STATUSES.includes(appt.status)) {
      throw new BadRequestException(`Cannot update appointment in status: ${appt.status}`);
    }

    const now = new Date();
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

      await tx.visitActivity.create({
        data: {
          visitRequestId: appt.visitRequestId,
          visitId: id,
          leadId: appt.leadId,
          actorId: user.sub,
          actorRole: user.role,
          type: activityType[dto.status] ?? VisitActivityType.VISIT_CONFIRMED,
          oldValue: { status: appt.status },
          newValue: { status: dto.status },
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
    });
  }

  async assignSales(id: string, dto: AssignSalesDto, user: AuthUser) {
    const appt = await this.prisma.visitAppointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');

    if (FINAL_STATUSES.includes(appt.status)) {
      throw new BadRequestException(`Cannot reassign appointment in status: ${appt.status}`);
    }

    const salesUser = await this.prisma.user.findUnique({
      where: { id: dto.assignedSalesId },
      select: { id: true, fullName: true, role: true },
    });
    if (!salesUser || (salesUser.role !== UserRole.SALES && salesUser.role !== UserRole.ADMIN)) {
      throw new BadRequestException('Assigned user must be a sales representative');
    }

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
          type: VisitActivityType.SALES_ASSIGNED,
          oldValue: { assignedSalesId: appt.assignedSalesId },
          newValue: { assignedSalesId: dto.assignedSalesId, salesName: salesUser.fullName },
        },
      });

      return updated;
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async nextVisitNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.visitAppointment.count();
    return `VA-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
