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
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Prisma, ReservationStatus, UnitStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';

class CreateReservationDto {
  @IsUUID() unitId!: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsInt() @Min(1) @Max(720) expiresInHours?: number;
}

class UpdateReservationStatusDto {
  @IsEnum(ReservationStatus) status!: ReservationStatus;
  @IsOptional() @IsString() reason?: string;
}

@Injectable()
class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(salesId: string, dto: CreateReservationDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new ConflictException('Unit is not available');
    }
    const expiresAt = new Date(Date.now() + (dto.expiresInHours ?? 72) * 3_600_000);

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          unitId: dto.unitId,
          salesId,
          leadId: dto.leadId ?? null,
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
          changedById: salesId,
          reason: `Reservation ${reservation.id}`,
        },
      });
      return reservation;
    });
  }

  async list(opts: {
    page: number;
    pageSize: number;
    status?: ReservationStatus;
    salesId?: string;
  }) {
    const where: Prisma.ReservationWhereInput = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.salesId ? { salesId: opts.salesId } : {}),
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
        },
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return paginate(data, total, opts);
  }

  async setStatus(id: string, dto: UpdateReservationStatusDto, actor: AuthUser) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { unit: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.status === dto.status) return reservation;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id },
        data: { status: dto.status },
      });

      // Handle unit side-effects
      if (
        dto.status === ReservationStatus.REJECTED ||
        dto.status === ReservationStatus.CANCELLED ||
        dto.status === ReservationStatus.EXPIRED
      ) {
        if (reservation.unit.status === UnitStatus.RESERVED) {
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

  async expireDue() {
    const due = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      select: { id: true, unitId: true, salesId: true },
    });
    for (const r of due) {
      await this.prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: r.id },
          data: { status: ReservationStatus.EXPIRED },
        });
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
    return this.svc.create(user.sub, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ReservationStatus,
    @Query('salesId') salesId?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const effectiveSalesId = user.role === UserRole.SALES ? user.sub : salesId;
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      salesId: effectiveSalesId,
    });
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
}

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationExpiryCron],
  exports: [ReservationsService],
})
export class ReservationsModule {}
