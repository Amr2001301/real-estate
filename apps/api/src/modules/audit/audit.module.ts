import {
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { scopedUserFindMany } from '../../common/tenant/resolve-tenant-entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';

const AUDIT_LOG_INCLUDE = {
  actor: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
    },
  },
} as const;

class AuditLogQueryDto {
  @IsOptional() @IsString() actorId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  /** Free-text contains-match against action/entityType/entityId/ip. */
  @IsOptional() @IsString() q?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

@Injectable()
class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List ────────────────────────────────────────────────────────────────

  async list(query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);

    const where = this.buildWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        ...takeSkip({ page, pageSize }),
        orderBy: { createdAt: 'desc' },
        include: AUDIT_LOG_INCLUDE,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  // ── Detail ──────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      include: AUDIT_LOG_INCLUDE,
    });
    if (!row) throw new NotFoundException('Audit log not found');
    return row;
  }

  // ── Operations summary ──────────────────────────────────────────────────
  //
  // Lightweight roll-up suitable for an Ops dashboard. All counts are derived
  // from `AuditLog` rows, so they reflect *successful* mutating actions only —
  // the current AuditInterceptor never writes failure rows. See
  // docs/phase-15-admin-operations-report.md for the full list of caveats.

  async summary() {
    const today = startOfDay(new Date());
    const weekAgo = daysAgo(7);
    const monthAgo = daysAgo(30);

    const [
      countToday,
      countWeek,
      countMonth,
      topActorsRaw,
      topEntitiesRaw,
      actionBreakdownRaw,
    ] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: monthAgo } } }),
      this.prisma.auditLog.groupBy({
        by: ['actorId'],
        where: { createdAt: { gte: weekAgo }, actorId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { actorId: 'desc' } },
        take: 5,
      }),
      this.prisma.auditLog.groupBy({
        by: ['entityType'],
        where: { createdAt: { gte: weekAgo } },
        _count: { _all: true },
        orderBy: { _count: { entityType: 'desc' } },
        take: 5,
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: weekAgo } },
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ]);

    // Resolve actor display strings (one round-trip, batched by ID).
    const actorIds = topActorsRaw
      .map((r) => r.actorId)
      .filter((v): v is string => Boolean(v));
    const actors = actorIds.length
      ? await scopedUserFindMany(
          this.prisma,
          { id: { in: actorIds } },
          { id: true, fullName: true, email: true, role: true },
        )
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    // Per-entity-type counts the dashboard surfaces individually. `entityType`
    // is a path-prefix the interceptor derives from the URL (e.g.
    // "brokers", "broker-payouts", "reservations"); we match by `contains`
    // so versioned prefixes don't lose data.
    const entityCounts = await this.entityCounts(weekAgo);

    return {
      totals: {
        today: countToday,
        last7Days: countWeek,
        last30Days: countMonth,
      },
      topActors: topActorsRaw.map((r) => ({
        actor: r.actorId ? actorMap.get(r.actorId) ?? null : null,
        count: countOf(r._count),
      })),
      topEntities: topEntitiesRaw.map((r) => ({
        entityType: r.entityType,
        count: countOf(r._count),
      })),
      topActions: actionBreakdownRaw.map((r) => ({
        action: r.action,
        count: countOf(r._count),
      })),
      entityCounts,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private buildWhere(query: AuditLogQueryDto): Prisma.AuditLogWhereInput {
    const conditions: Prisma.AuditLogWhereInput = {};
    if (query.actorId) conditions.actorId = query.actorId;
    if (query.action) conditions.action = query.action;
    if (query.entityType) conditions.entityType = { contains: query.entityType };
    if (query.entityId) conditions.entityId = query.entityId;
    if (query.from || query.to) {
      conditions.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.q) {
      conditions.OR = [
        { entityType: { contains: query.q, mode: 'insensitive' } },
        { entityId: { contains: query.q, mode: 'insensitive' } },
        { action: { contains: query.q, mode: 'insensitive' } },
        { ip: { contains: query.q } },
      ];
    }
    return conditions;
  }

  private async entityCounts(since: Date) {
    // Each label maps to a set of `entityType` path-prefix needles. We use
    // `contains` so future renames (e.g. broker-payouts → /v2/broker-payouts)
    // continue to match.
    const groups: Array<{ label: string; needles: string[] }> = [
      { label: 'brokers', needles: ['brokers'] },
      { label: 'brokerUsers', needles: ['broker-users'] },
      { label: 'brokerLeads', needles: ['broker-leads'] },
      { label: 'brokerReservations', needles: ['broker-reservations'] },
      { label: 'brokerContracts', needles: ['broker-contracts'] },
      { label: 'brokerCommissions', needles: ['broker-commissions'] },
      { label: 'brokerPayouts', needles: ['broker-payouts'] },
      { label: 'reservations', needles: ['v1/reservations'] },
      { label: 'contracts', needles: ['v1/contracts'] },
    ];
    const counts = await Promise.all(
      groups.map(async ({ label, needles }) => {
        const count = await this.prisma.auditLog.count({
          where: {
            createdAt: { gte: since },
            OR: needles.map((n) => ({ entityType: { contains: n } })),
          },
        });
        return { label, count };
      }),
    );
    return Object.fromEntries(counts.map((c) => [c.label, c.count])) as Record<string, number>;
  }
}

// Prisma's typed `groupBy` doesn't statically narrow `_count._all` so unwrap
// it through this small helper to keep call sites readable.
function countOf(c: unknown): number {
  if (c && typeof c === 'object' && '_all' in (c as Record<string, unknown>)) {
    const v = (c as { _all?: unknown })._all;
    if (typeof v === 'number') return v;
  }
  return 0;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function daysAgo(days: number): Date {
  const out = new Date();
  out.setDate(out.getDate() - days);
  return out;
}

@ApiTags('audit')
@Controller()
class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('audit:read')
  @Get('audit-logs')
  list(@Query() query: AuditLogQueryDto) {
    return this.svc.list(query);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('audit:read')
  @Get('audit-logs/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('audit:read')
  @Get('operations/summary')
  summary() {
    return this.svc.summary();
  }
}

@Module({
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
