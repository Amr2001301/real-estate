import {
  Controller,
  Get,
  Header,
  Injectable,
  Module,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  DepositType,
  InstallmentStatus,
  Prisma,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { toCsv, type CsvCell } from '../../common/utils/csv';

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

  async financialDashboard(opts: {
    projectId?: string;
    q?: string;
    type?: DepositType;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const now = new Date();
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const weekEnd = new Date(
      todayUTC.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    // ── Installment filter blocks ──────────────────────────────────────────
    const instAnd: Prisma.InstallmentWhereInput[] = [];
    if (opts.projectId) {
      instAnd.push({
        plan: {
          contract: {
            unit: { building: { phase: { projectId: opts.projectId } } },
          },
        },
      });
    }
    if (opts.q) {
      instAnd.push({
        plan: {
          contract: {
            customer: {
              fullName: {
                contains: opts.q,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          },
        },
      });
    }

    // ── Deposit filter blocks ──────────────────────────────────────────────
    // base: projectId + q + type (no date — used for fixed-period "this month" KPI)
    const baseDepAnd: Prisma.DepositWhereInput[] = [];
    if (opts.projectId) {
      baseDepAnd.push({
        OR: [
          {
            contract: {
              unit: { building: { phase: { projectId: opts.projectId } } },
            },
          },
          {
            reservation: {
              unit: { building: { phase: { projectId: opts.projectId } } },
            },
          },
        ],
      });
    }
    if (opts.q) {
      baseDepAnd.push({
        OR: [
          {
            contract: {
              customer: {
                fullName: {
                  contains: opts.q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          },
          {
            reservation: {
              client: {
                fullName: {
                  contains: opts.q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          },
          {
            reservation: {
              lead: {
                fullName: {
                  contains: opts.q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          },
        ],
      });
    }
    if (opts.type) baseDepAnd.push({ type: opts.type });

    // filtered: base + optional date range (used for totalCollected, depositCount, recentDeposits)
    const filteredDepAnd: Prisma.DepositWhereInput[] = [...baseDepAnd];
    if (opts.dateFrom || opts.dateTo) {
      filteredDepAnd.push({
        paidAt: {
          ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
          ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}),
        },
      });
    }

    // ── Contract filter blocks ─────────────────────────────────────────────
    const contractAnd: Prisma.ContractWhereInput[] = [];
    if (opts.projectId) {
      contractAnd.push({
        unit: { building: { phase: { projectId: opts.projectId } } },
      });
    }
    if (opts.q) {
      contractAnd.push({
        customer: {
          fullName: {
            contains: opts.q,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      });
    }

    // ── Helper factories ──────────────────────────────────────────────────
    const instWhere = (
      extra: Prisma.InstallmentWhereInput,
    ): Prisma.InstallmentWhereInput => ({ AND: [...instAnd, extra] });

    const baseDepWhere = (
      extra?: Prisma.DepositWhereInput,
    ): Prisma.DepositWhereInput =>
      baseDepAnd.length === 0 && !extra
        ? {}
        : { AND: [...baseDepAnd, ...(extra ? [extra] : [])] };

    const filteredDepWhere = (
      extra?: Prisma.DepositWhereInput,
    ): Prisma.DepositWhereInput =>
      filteredDepAnd.length === 0 && !extra
        ? {}
        : { AND: [...filteredDepAnd, ...(extra ? [extra] : [])] };

    const contractWhere: Prisma.ContractWhereInput =
      contractAnd.length > 0 ? { AND: contractAnd } : {};

    // ── Shared installment select for tables ───────────────────────────────
    const instSelect = {
      id: true,
      type: true,
      dueDate: true,
      amount: true,
      status: true,
      plan: {
        select: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              customer: { select: { id: true, fullName: true } },
              unit: { select: { id: true, code: true } },
            },
          },
        },
      },
    } as const;

    // ── Run all 13 queries in parallel ────────────────────────────────────
    const [
      totalContractAgg,
      totalCollectedAgg,
      totalRemainingAgg,
      totalOverdueAgg,
      collectedThisMonthAgg,
      dueThisMonthAgg,
      contractCount,
      depositCount,
      overdueCount,
      overdueRows,
      upcomingWeekRows,
      upcomingMonthRows,
      recentDeposits,
    ] = await Promise.all([
      // ── KPI aggregates ──
      this.prisma.contract.aggregate({
        where: contractWhere,
        _sum: { totalAmount: true },
      }),
      this.prisma.deposit.aggregate({
        where: filteredDepWhere(),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({
          status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
        }),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({ status: InstallmentStatus.OVERDUE }),
        _sum: { amount: true },
      }),
      // collectedThisMonth uses baseDepWhere (ignores user date range — always current month)
      this.prisma.deposit.aggregate({
        where: baseDepWhere({ paidAt: { gte: monthStart, lt: monthEnd } }),
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: instWhere({
          dueDate: { gte: monthStart, lt: monthEnd },
          status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
        }),
        _sum: { amount: true },
      }),
      // ── KPI counts ──
      this.prisma.contract.count({ where: contractWhere }),
      this.prisma.deposit.count({ where: filteredDepWhere() }),
      this.prisma.installment.count({
        where: instWhere({ status: InstallmentStatus.OVERDUE }),
      }),
      // ── Overdue table ──
      this.prisma.installment.findMany({
        where: instWhere({ status: InstallmentStatus.OVERDUE }),
        select: instSelect,
        orderBy: { dueDate: 'asc' },
        take: 50,
      }),
      // ── Upcoming this week: [today, today+7) PENDING ──
      this.prisma.installment.findMany({
        where: instWhere({
          status: InstallmentStatus.PENDING,
          dueDate: { gte: todayUTC, lt: weekEnd },
        }),
        select: instSelect,
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      // ── Upcoming rest of month: [today+7, monthEnd) PENDING ──
      this.prisma.installment.findMany({
        where: instWhere({
          status: InstallmentStatus.PENDING,
          dueDate: { gte: weekEnd, lt: monthEnd },
        }),
        select: instSelect,
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      // ── Recent deposits ──
      this.prisma.deposit.findMany({
        where: filteredDepWhere(),
        orderBy: { paidAt: 'desc' },
        take: 10,
        select: {
          id: true,
          type: true,
          amount: true,
          paidAt: true,
          verified: true,
          contract: {
            select: {
              id: true,
              contractNumber: true,
              customer: { select: { id: true, fullName: true } },
              unit: { select: { id: true, code: true } },
            },
          },
          reservation: {
            select: {
              id: true,
              reservationNumber: true,
              unit: { select: { id: true, code: true } },
              client: { select: { id: true, fullName: true } },
              lead: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
    ]);

    const zero = new Prisma.Decimal(0);

    // ── Cashflow trend: last 6 months (collected vs due) ──────────────────────
    const trendSlots = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1),
      );
      return {
        start: d,
        end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
        month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        label: new Intl.DateTimeFormat('ar-EG', {
          month: 'short',
          timeZone: 'UTC',
        }).format(d),
      };
    });

    const [trendCollected, trendDue] = await Promise.all([
      Promise.all(
        trendSlots.map(({ start, end }) =>
          this.prisma.deposit.aggregate({
            where: baseDepWhere({ paidAt: { gte: start, lt: end } }),
            _sum: { amount: true },
          }),
        ),
      ),
      Promise.all(
        trendSlots.map(({ start, end }) =>
          this.prisma.installment.aggregate({
            where: instWhere({ dueDate: { gte: start, lt: end } }),
            _sum: { amount: true },
          }),
        ),
      ),
    ]);

    const cashflowTrend = trendSlots.map(({ month, label }, i) => ({
      month,
      label,
      collected: Number(trendCollected[i]?._sum.amount ?? 0),
      due: Number(trendDue[i]?._sum.amount ?? 0),
    }));

    return {
      summary: {
        totalContractValue: (
          totalContractAgg._sum.totalAmount ?? zero
        ).toString(),
        totalCollected: (totalCollectedAgg._sum.amount ?? zero).toString(),
        totalRemaining: (totalRemainingAgg._sum.amount ?? zero).toString(),
        totalOverdue: (totalOverdueAgg._sum.amount ?? zero).toString(),
        collectedThisMonth: (
          collectedThisMonthAgg._sum.amount ?? zero
        ).toString(),
        dueThisMonth: (dueThisMonthAgg._sum.amount ?? zero).toString(),
        contractCount,
        depositCount,
        overdueInstallmentCount: overdueCount,
      },
      overdue: overdueRows,
      upcomingThisWeek: upcomingWeekRows,
      upcomingThisMonth: upcomingMonthRows,
      recentDeposits,
      cashflowTrend,
    };
  }

  // ── CSV builders ─────────────────────────────────────────────────────────
  // Each builder takes the already-computed report payload and emits a CSV
  // string with a UTF-8 BOM (Excel-friendly Arabic). Reuses the service's
  // existing data methods — no new business logic.

  async salesCsv(period?: string): Promise<string> {
    const data = await this.sales(period);

    // Section 1 — summary KPIs (one row per metric)
    const summaryRows: CsvCell[][] = [
      ['الفترة', period ?? 'الكل'],
      ['عدد العقود', data.contracts],
      ['إجمالي قيمة العقود', Number(data.total).toFixed(2)],
    ];

    // Section 2 — per-project breakdown
    const projectHeaders = ['معرّف المشروع', 'عدد العقود', 'إجمالي القيمة'];
    const projectRows: CsvCell[][] = (data.byProject ?? []).map((p) => [
      p.projectId,
      p.count,
      Number(p.total).toFixed(2),
    ]);

    return [
      toCsv(['المؤشر', 'القيمة'], summaryRows),
      '',
      toCsv(projectHeaders, projectRows),
    ].join('\r\n');
  }

  async financialCsv(period?: string): Promise<string> {
    const data = await this.financial(period);
    const rows: CsvCell[][] = [
      ['الفترة', period ?? 'الكل'],
      ['عدد الدفعات', data.deposits],
      ['الدفعات الموثّقة', data.verified],
      ['إجمالي المبالغ المحصّلة', Number(data.total).toFixed(2)],
    ];
    return toCsv(['المؤشر', 'القيمة'], rows);
  }

  async operationalCsv(): Promise<string> {
    // Operational export bundles two existing reads: KPIs + reservation
    // breakdown by status. They are emitted as two stacked tables so the
    // user can read them with a single download.
    const [k, r] = await Promise.all([this.kpis(), this.reservations()]);

    const kpiRows: CsvCell[][] = [
      ['المشاريع المنشورة', k.projects],
      ['إجمالي الوحدات', k.units.total],
      ['وحدات متاحة', k.units.available],
      ['وحدات محجوزة', k.units.reserved],
      ['وحدات مباعة', k.units.sold],
      ['إجمالي العملاء المتصفّحين (Leads)', k.leads.total],
      ['عملاء جدد', k.leads.new],
      ['زيارات قيد الانتظار', k.pendingVisits],
      ['عدد العقود', k.contracts],
      ['إجمالي الدفعات المحصّلة', Number(k.depositsTotal).toFixed(2)],
    ];

    const reservationRows: CsvCell[][] = Object.entries(r).map(
      ([status, count]) => [status, count],
    );

    return [
      toCsv(['المؤشر', 'القيمة'], kpiRows),
      '',
      toCsv(['حالة الحجز', 'العدد'], reservationRows),
    ].join('\r\n');
  }

  async financialDashboardCsv(opts: {
    projectId?: string;
    q?: string;
    type?: DepositType;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<string> {
    const data = await this.financialDashboard(opts);

    const summaryRows: CsvCell[][] = [
      ['إجمالي قيمة العقود', data.summary.totalContractValue],
      ['إجمالي المحصّل', data.summary.totalCollected],
      ['المتبقي', data.summary.totalRemaining],
      ['المتأخر', data.summary.totalOverdue],
      ['المحصّل هذا الشهر', data.summary.collectedThisMonth],
      ['المستحق هذا الشهر', data.summary.dueThisMonth],
      ['عدد العقود', data.summary.contractCount],
      ['عدد الدفعات', data.summary.depositCount],
      ['أقساط متأخرة', data.summary.overdueInstallmentCount],
    ];

    // We use a permissive shape here — the report payload's nested selects
    // vary slightly between branches and aren't worth a new exported type
    // just for the CSV builder.
    type InstRow = {
      id: string;
      type: string;
      dueDate: Date | string;
      amount: Prisma.Decimal | string | number;
      status: string;
      plan: {
        contract: {
          contractNumber: string | null;
          customer: { fullName: string };
          unit: { code: string };
        };
      };
    };
    type DepositRow = {
      id: string;
      type: string;
      amount: Prisma.Decimal | string | number;
      paidAt: Date | string;
      verified: boolean;
      contract:
        | {
            contractNumber: string | null;
            customer: { fullName: string } | null;
            unit: { code: string } | null;
          }
        | null;
      reservation:
        | {
            reservationNumber: string | null;
            unit: { code: string } | null;
            client: { fullName: string } | null;
            lead: { fullName: string } | null;
          }
        | null;
    };

    const fmtInst = (rows: InstRow[]): CsvCell[][] =>
      rows.map((r) => [
        r.plan.contract.contractNumber ?? '',
        r.plan.contract.customer.fullName,
        r.plan.contract.unit.code,
        r.type,
        new Date(r.dueDate).toISOString().slice(0, 10),
        r.amount.toString(),
        r.status,
      ]);

    const overdueRows = fmtInst(data.overdue as unknown as InstRow[]);
    const weekRows = fmtInst(data.upcomingThisWeek as unknown as InstRow[]);
    const monthRows = fmtInst(data.upcomingThisMonth as unknown as InstRow[]);

    const depositRows: CsvCell[][] = (
      data.recentDeposits as unknown as DepositRow[]
    ).map((d) => [
      d.contract?.contractNumber ?? d.reservation?.reservationNumber ?? '',
      d.contract?.customer?.fullName ??
        d.reservation?.client?.fullName ??
        d.reservation?.lead?.fullName ??
        '',
      d.contract?.unit?.code ?? d.reservation?.unit?.code ?? '',
      d.type,
      new Date(d.paidAt).toISOString().slice(0, 10),
      d.amount.toString(),
      d.verified ? 'نعم' : 'لا',
    ]);

    const instHeaders = [
      'رقم العقد',
      'العميل',
      'كود الوحدة',
      'النوع',
      'تاريخ الاستحقاق',
      'المبلغ',
      'الحالة',
    ];
    const depHeaders = [
      'المرجع',
      'العميل',
      'كود الوحدة',
      'النوع',
      'تاريخ السداد',
      'المبلغ',
      'موثّقة',
    ];

    return [
      '# ملخص',
      toCsv(['المؤشر', 'القيمة'], summaryRows),
      '',
      '# الأقساط المتأخرة',
      toCsv(instHeaders, overdueRows),
      '',
      '# أقساط مستحقة هذا الأسبوع',
      toCsv(instHeaders, weekRows),
      '',
      '# أقساط مستحقة هذا الشهر',
      toCsv(instHeaders, monthRows),
      '',
      '# آخر الدفعات',
      toCsv(depHeaders, depositRows),
    ].join('\r\n');
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

class FinancialDashboardQueryDto {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(DepositType) type?: DepositType;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}

@ApiTags('reports')
@Controller('reports')
class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('kpis')
  kpis() {
    return this.svc.kpis();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('sales')
  sales(@Query('period') period?: string) {
    return this.svc.sales(period);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial')
  financial(@Query('period') period?: string) {
    return this.svc.financial(period);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('reservations')
  reservations() {
    return this.svc.reservations();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial-dashboard')
  financialDashboard(@Query() query: FinancialDashboardQueryDto) {
    return this.svc.financialDashboard({
      projectId: query.projectId,
      q: query.q,
      type: query.type,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  // ── CSV exports ────────────────────────────────────────────────────────
  // Each returns a raw CSV string; @Header switches the response so the
  // browser treats the body as a download. Permissions mirror the matching
  // JSON read route exactly.

  @Roles(UserRole.ADMIN)
  @Permissions('reports:sales:read')
  @Get('sales/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sales-report.csv"')
  salesCsv(@Query('period') period?: string) {
    return this.svc.salesCsv(period);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="financial-report.csv"')
  financialCsv(@Query('period') period?: string) {
    return this.svc.financialCsv(period);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:operational:read')
  @Get('operational/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="operational-report.csv"')
  operationalCsv() {
    return this.svc.operationalCsv();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('reports:financial:read')
  @Get('financial-dashboard/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="financial-dashboard.csv"')
  financialDashboardCsv(@Query() query: FinancialDashboardQueryDto) {
    return this.svc.financialDashboardCsv({
      projectId: query.projectId,
      q: query.q,
      type: query.type,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
