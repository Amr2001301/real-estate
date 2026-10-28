import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { BrokerContractsQueryDto } from './dto/broker-contract.dto';

const BROKER_CONTRACT_INCLUDE = {
  customer: {
    select: { id: true, fullName: true, phone: true, email: true },
  },
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
  reservation: {
    select: {
      id: true,
      reservationNumber: true,
      commissionLockedPct: true,
      commissionLockedAmount: true,
      sales: { select: { id: true, fullName: true, email: true, phone: true } },
      lead: { select: { id: true, fullName: true, phone: true } },
    },
  },
  brokerCommission: {
    select: {
      id: true,
      commissionNumber: true,
      commissionPct: true,
      grossAmount: true,
      netAmount: true,
      status: true,
    },
  },
  installmentPlan: {
    select: {
      id: true,
      totalMonths: true,
      monthlyAmount: true,
      startsAt: true,
      frequency: true,
    },
  },
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
} as const;

@Injectable()
export class BrokerContractsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * PRM2 — `salesIds` is what the caller sees (own / team), undefined for
   * the whole company (ADMIN or contracts:read:all); see company-wide.ts.
   */
  async list(query: BrokerContractsQueryDto, salesIds: string[] | undefined) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Only broker-attributed contracts, of the reps the caller sees (via the
    // source reservation's internal sales handler); a requested rep narrows it.
    const reps = narrowReps(salesIds, query.salesId);
    const where: Prisma.ContractWhereInput = {
      NOT: { brokerId: null },
      ...(reps ? { reservation: { salesId: { in: reps } } } : {}),
      ...(query.brokerId ? { brokerId: query.brokerId } : {}),
      ...(query.projectId
        ? { unit: { building: { phase: { projectId: query.projectId } } } }
        : {}),
      ...(query.signed === 'yes'
        ? { signedAt: { not: null } }
        : query.signed === 'no'
          ? { signedAt: null }
          : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...takeSkip({ page, pageSize }),
        include: BROKER_CONTRACT_INCLUDE,
      }),
      this.prisma.contract.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string, salesIds: string[] | undefined) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        ...BROKER_CONTRACT_INCLUDE,
        installmentPlan: {
          include: { installments: { orderBy: { dueDate: 'asc' } } },
        },
        deposits: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (!contract.brokerId) {
      throw new NotFoundException(
        'This contract is not broker-attributed; use the regular contracts endpoint instead',
      );
    }
    // Only a contract whose reservation a rep the caller sees handles.
    if (salesIds) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: contract.reservationId ?? '' },
        select: { salesId: true },
      });
      if (!reservation || !salesIds.includes(reservation.salesId)) {
        throw new NotFoundException('Contract not found');
      }
    }
    return contract;
  }
}

/** The reps to filter on: the caller's scope, narrowed to one requested rep. */
export function narrowReps(scope: string[] | undefined, requested?: string): string[] | undefined {
  if (!requested) return scope;
  return !scope || scope.includes(requested) ? [requested] : [];
}
