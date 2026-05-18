import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerPortalReservationsService } from '../broker-portal/broker-portal-reservations.service';
import {
  BrokerReservationsQueryDto,
  CreateAdminBrokerReservationDto,
} from './dto/broker-reservation.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly portalReservations: BrokerPortalReservationsService,
  ) {}

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

  // ── Admin "create on behalf of broker" (Phase 18A) ─────────────────────
  //
  // Admin enters a reservation that a broker phoned/whatsapp'd in. Identity
  // checks (broker active, optional agent belongs to broker + is active)
  // happen here; the rest of the validation — lead approved, sales assigned,
  // unit visible to broker, unit AVAILABLE, no duplicate active reservation,
  // commission snapshot — is delegated to the shared core in
  // `BrokerPortalReservationsService.createForActor()` so portal and admin
  // paths can never drift.

  async createOnBehalfOfBroker(
    actor: AuthUser,
    dto: CreateAdminBrokerReservationDto,
  ) {
    const broker = await this.prisma.broker.findUnique({
      where: { id: dto.brokerId },
      select: { id: true, status: true, companyName: true },
    });
    if (!broker) throw new NotFoundException('Broker not found');
    if (broker.status !== 'ACTIVE') {
      throw new ConflictException(
        `Broker ${broker.companyName} is not ACTIVE — cannot create a reservation on their behalf`,
      );
    }

    if (dto.brokerAgentId) {
      const agent = await this.prisma.brokerUser.findUnique({
        where: { id: dto.brokerAgentId },
        select: { id: true, userId: true, brokerId: true, status: true },
      });
      if (!agent || agent.brokerId !== dto.brokerId) {
        throw new BadRequestException(
          'brokerAgentId does not belong to the selected broker firm',
        );
      }
      if (agent.status !== 'ACTIVE') {
        throw new ConflictException('Selected broker agent is not ACTIVE');
      }

      return this.portalReservations.createForActor({
        brokerId: dto.brokerId,
        brokerAgentUserId: agent.userId,
        actorUserId: actor.sub,
        origin: 'ADMIN_ON_BEHALF',
        dto: {
          leadId: dto.leadId,
          unitId: dto.unitId,
          installmentPlanTemplateId: dto.installmentPlanTemplateId,
          selectedDurationOptionId: dto.selectedDurationOptionId,
          notes: dto.notes,
          expiresInHours: dto.expiresInHours,
        },
      });
    }

    return this.portalReservations.createForActor({
      brokerId: dto.brokerId,
      brokerAgentUserId: null,
      actorUserId: actor.sub,
      origin: 'ADMIN_ON_BEHALF',
      dto: {
        leadId: dto.leadId,
        unitId: dto.unitId,
        installmentPlanTemplateId: dto.installmentPlanTemplateId,
        selectedDurationOptionId: dto.selectedDurationOptionId,
        notes: dto.notes,
        expiresInHours: dto.expiresInHours,
      },
    });
  }
}
