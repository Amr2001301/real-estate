import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma, ReservationStatus, UnitStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Injectable()
class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async kpis() {
    const [
      projects,
      units,
      available,
      reserved,
      sold,
      leadsTotal,
      leadsNew,
      pendingVisits,
      contracts,
      revenue,
    ] = await this.prisma.$transaction([
      this.prisma.project.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.unit.count(),
      this.prisma.unit.count({ where: { status: UnitStatus.AVAILABLE } }),
      this.prisma.unit.count({ where: { status: UnitStatus.RESERVED } }),
      this.prisma.unit.count({ where: { status: UnitStatus.SOLD } }),
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { stage: 'NEW' } }),
      this.prisma.visitRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.contract.count(),
      this.prisma.deposit.aggregate({ _sum: { amount: true } }),
    ]);
    return {
      projects,
      units: { total: units, available, reserved, sold },
      leads: { total: leadsTotal, new: leadsNew },
      pendingVisits,
      contracts,
      depositsTotal: revenue._sum.amount ?? 0,
    };
  }

  async sales(period?: string) {
    // period: YYYY-MM
    const where: Prisma.ContractWhereInput = period
      ? this.periodWhereContract(period)
      : {};
    const [count, totalAmount, byProject] = await this.prisma.$transaction([
      this.prisma.contract.count({ where }),
      this.prisma.contract.aggregate({ where, _sum: { totalAmount: true } }),
      this.prisma.$queryRawUnsafe<Array<{ projectId: string; total: number; count: number }>>(`
        SELECT p.id as "projectId", COUNT(c.*)::int as count, COALESCE(SUM(c."totalAmount"), 0)::float as total
        FROM "Contract" c
        JOIN "Unit" u ON u.id = c."unitId"
        JOIN "Building" b ON b.id = u."buildingId"
        JOIN "Phase" ph ON ph.id = b."phaseId"
        JOIN "Project" p ON p.id = ph."projectId"
        ${period ? `WHERE to_char(c."createdAt", 'YYYY-MM') = '${period.replace(/[^0-9-]/g, '')}'` : ''}
        GROUP BY p.id
        ORDER BY total DESC
      `),
    ]);
    return {
      contracts: count,
      total: totalAmount._sum.totalAmount ?? 0,
      byProject,
    };
  }

  async financial(period?: string) {
    const where: Prisma.DepositWhereInput = period
      ? this.periodWhereDeposit(period)
      : {};
    const [count, sum, verified] = await this.prisma.$transaction([
      this.prisma.deposit.count({ where }),
      this.prisma.deposit.aggregate({ where, _sum: { amount: true } }),
      this.prisma.deposit.count({ where: { ...where, verified: true } }),
    ]);
    return {
      deposits: count,
      verified,
      total: sum._sum.amount ?? 0,
    };
  }

  async reservations() {
    const groups = await this.prisma.reservation.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return groups.reduce<Record<string, number>>(
      (acc, g) => ((acc[g.status] = g._count._all), acc),
      {},
    );
  }

  private periodWhereContract(period: string): Prisma.ContractWhereInput {
    const [y, m] = period.split('-').map(Number);
    const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
    const end = new Date(Date.UTC(y!, m!, 1));
    return { createdAt: { gte: start, lt: end } };
  }

  private periodWhereDeposit(period: string): Prisma.DepositWhereInput {
    const [y, m] = period.split('-').map(Number);
    const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
    const end = new Date(Date.UTC(y!, m!, 1));
    return { paidAt: { gte: start, lt: end } };
  }
}

@ApiTags('reports')
@Controller('reports')
class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Roles(UserRole.ADMIN)
  @Get('kpis')
  kpis() {
    return this.svc.kpis();
  }

  @Roles(UserRole.ADMIN)
  @Get('sales')
  sales(@Query('period') period?: string) {
    return this.svc.sales(period);
  }

  @Roles(UserRole.ADMIN)
  @Get('financial')
  financial(@Query('period') period?: string) {
    return this.svc.financial(period);
  }

  @Roles(UserRole.ADMIN)
  @Get('reservations')
  reservations() {
    return this.svc.reservations();
  }
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
