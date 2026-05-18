import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerReservationsQueryDto } from './dto/broker-reservation.dto';

const BROKER_RESERVATION_INCLUDE = {
  unit: {
    select: {
      id: true,
      code: true,
      type: true,
      price: true,
      status: true,
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
  client: { select: { id: true, fullName: true, phone: true, email: true } },
  sales: { select: { id: true, fullName: true, email: true, phone: true } },
  broker: {
    select: {
      id: true,
      companyName: true,
      commercialName: true,
      code: true,
      status: true,
    },
  },
  brokerAgent: {
    select: { id: true, fullName: true, email: true, phone: true },
  },
  installmentPlanTemplate: {
    select: {
      id: true,
      name: true,
      netPrice: true,
      reservationAmount: true,
    },
  },
  selectedDurationOption: {
    select: { id: true, durationMonths: true, increasePercentage: true },
  },
} as const;

@Injectable()
export class BrokerReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: BrokerReservationsQueryDto, actor: AuthUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Only broker-originated reservations (brokerId IS NOT NULL).
    // SALES users see only their own internal-handler reservations — same
    // convention as the existing /reservations list.
    const where: Prisma.ReservationWhereInput = {
      NOT: { brokerId: null },
      ...(actor.role === 'SALES' ? { salesId: actor.sub } : {}),
      ...(query.brokerId ? { brokerId: query.brokerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.salesId && actor.role !== 'SALES'
        ? { salesId: query.salesId }
        : {}),
      ...(query.projectId
        ? { unit: { building: { phase: { projectId: query.projectId } } } }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        ...takeSkip({ page, pageSize }),
        include: BROKER_RESERVATION_INCLUDE,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string, actor: AuthUser) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        ...BROKER_RESERVATION_INCLUDE,
        reservationNotes: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { author: { select: { id: true, fullName: true } } },
        },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (!reservation.brokerId) {
      throw new NotFoundException(
        'This reservation was not created by a broker; use the regular reservations endpoint instead',
      );
    }
    // SALES users can only view reservations they handle internally.
    if (actor.role === 'SALES' && reservation.salesId !== actor.sub) {
      throw new NotFoundException('Reservation not found');
    }
    return reservation;
  }
}
