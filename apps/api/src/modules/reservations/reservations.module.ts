import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
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
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import {
  LeadStage,
  Prisma,
  ReservationActivityType,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';

class CreateReservationDto {
  @IsUUID() unitId!: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() salesId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsInt() @Min(1) @Max(720) expiresInHours?: number;
}

class UpdateReservationStatusDto {
  @IsEnum(ReservationStatus) status!: ReservationStatus;
  @IsOptional() @IsString() reason?: string;
}

class UpdateReservationDto {
  @IsOptional() @IsUUID() salesId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(720) expiresInHours?: number;
  @IsOptional() @IsString() notes?: string;
}

class AddNoteDto {
  @IsString() @IsNotEmpty() body!: string;
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
class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextReservationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.reservation.count();
    return `RES-${year}-${String(count + 1).padStart(4, '0')}`;
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

    let resolvedClientId: string | null = null;
    if (dto.clientId) {
      const clientUser = await this.prisma.user.findUnique({
        where: { id: dto.clientId },
        select: { id: true, role: true, active: true },
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
    } else if (dto.leadId) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: dto.leadId },
        select: { id: true, clientId: true },
      });
      if (!lead) {
        throw new BadRequestException('Lead not found');
      }
      resolvedClientId = lead.clientId ?? null;
    }

    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new ConflictException('Unit is not available');
    }
    const expiresAt = new Date(Date.now() + (dto.expiresInHours ?? 72) * 3_600_000);
    const reservationNumber = await this.nextReservationNumber();

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
        const bumpableStages: LeadStage[] = [
          LeadStage.NEW,
          LeadStage.INTERESTED,
          LeadStage.VISIT,
        ];
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
        sales: { select: { fullName: true } },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('Only pending reservations can be edited');
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
}

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationExpiryCron],
  exports: [ReservationsService],
})
export class ReservationsModule {}
