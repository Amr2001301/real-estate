import type Anthropic from '@anthropic-ai/sdk';
import { InstallmentStatus, LeadStage, Prisma, ReservationStatus, UnitStatus, UserRole } from '@prisma/client';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { BILLABLE_PLAN_WHERE, LIVE_CONTRACT_WHERE } from '../installments/live-contract';
import { netContractValue } from '../../common/finance/commission-basis';
import { scopedUserFindMany } from '../../common/tenant/resolve-tenant-entity';

/** Who is asking: the assistant only reads what this person may see. */
export interface AssistantActor {
  userId: string;
  role: UserRole;
  companyId: string;
}

const DAY = 24 * 60 * 60 * 1000;
const MAX_ROWS = 25;

function limitOf(v: unknown, fallback = 10) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_ROWS) : fallback;
}

function text(v: unknown): string {
  if (v && typeof v === 'object') {
    const t = v as { ar?: string; en?: string };
    return t.ar || t.en || '';
  }
  return typeof v === 'string' ? v : '';
}

function money(v: Prisma.Decimal | number | null | undefined) {
  return v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100;
}

function oneOf<T extends string>(v: unknown, values: readonly T[]): T | undefined {
  return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : undefined;
}

/**
 * The assistant's tools: read-only questions about the company's data, each
 * scoped to the asker — a sales rep sees their own leads, reservations, visits
 * and clients' installments; a sales manager their team's; an admin the whole
 * company. Every query names the company; run it inside that company's
 * tenant context.
 */
export const ASSISTANT_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'company_overview',
    description:
      'Key figures for the asker: units by status, open leads by stage, open reservations, overdue installments (count and amount), and — for admins and sales managers — contracts signed this month and their net value. Use for general "how are we doing" questions.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_overdue_installments',
    description:
      'Installments past their due date and not paid, on signed contracts, oldest first: customer, phone, unit, project, amount, due date and days late.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', description: 'How many rows, at most 25 (default 10).' } },
      additionalProperties: false,
    },
  },
  {
    name: 'search_units',
    description:
      'Find units in the inventory: code, project, type, area (m²), bedrooms, price and status. Filters are optional.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['AVAILABLE', 'RESERVED', 'SOLD'] },
        project: { type: 'string', description: 'Part of the project name, Arabic or English.' },
        minBedrooms: { type: 'integer' },
        maxPrice: { type: 'number' },
        limit: { type: 'integer', description: 'At most 25 (default 10).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_leads',
    description:
      'Sales leads (potential buyers): name, phone, stage, assigned rep, created date — newest first. "unassigned" (leads with no rep) is for admins and sales managers only.',
    input_schema: {
      type: 'object',
      properties: {
        stage: { type: 'string', enum: ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'] },
        unassigned: { type: 'boolean' },
        limit: { type: 'integer', description: 'At most 25 (default 10).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_reservations',
    description:
      'Unit reservations (bookings): number, unit, client, rep, status and expiry — newest first. Defaults to open ones (pending and approved).',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'CONVERTED'] },
        limit: { type: 'integer', description: 'At most 25 (default 10).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'upcoming_visits',
    description: 'Site visits scheduled from now over the next N days (default 1 = today and tomorrow morning): time, client, project, rep and status.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', description: '1 to 14 (default 1).' } },
      additionalProperties: false,
    },
  },
];

export class AssistantTools {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actor: AssistantActor,
  ) {}

  /** The reps whose work the asker may see: null = everyone in the company. */
  private async reps(): Promise<string[] | null> {
    if (this.actor.role === UserRole.ADMIN) return null;
    if (this.actor.role === UserRole.SALES_MANAGER) {
      const team = await scopedUserFindMany(this.prisma, { managerId: this.actor.userId }, { id: true });
      return [this.actor.userId, ...team.map((u) => u.id)];
    }
    return [this.actor.userId];
  }

  private get canSeeCompany() {
    return this.actor.role === UserRole.ADMIN || this.actor.role === UserRole.SALES_MANAGER;
  }

  async run(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'company_overview':
        return this.overview();
      case 'list_overdue_installments':
        return this.overdue(input);
      case 'search_units':
        return this.units(input);
      case 'list_leads':
        return this.leads(input);
      case 'list_reservations':
        return this.reservations(input);
      case 'upcoming_visits':
        return this.visits(input);
      default:
        return { error: `Unknown tool ${name}` };
    }
  }

  private overdueWhere(reps: string[] | null): Prisma.InstallmentWhereInput {
    const now = new Date();
    return {
      companyId: this.actor.companyId,
      plan: {
        ...BILLABLE_PLAN_WHERE,
        ...(reps ? { contract: { ...BILLABLE_PLAN_WHERE.contract, reservation: { salesId: { in: reps } } } } : {}),
      },
      OR: [
        { status: InstallmentStatus.OVERDUE },
        { status: InstallmentStatus.PENDING, dueDate: { lt: new Date(now.getTime() - DAY) } },
      ],
    };
  }

  private async overview() {
    const companyId = this.actor.companyId;
    const reps = await this.reps();
    const mine = reps ? { in: reps } : undefined;
    const [units, leads, openReservations, overdue] = await Promise.all([
      this.prisma.unit.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
      this.prisma.lead.groupBy({
        by: ['stage'],
        where: { companyId, stage: { notIn: [LeadStage.WON, LeadStage.LOST] }, ...(mine ? { assignedSalesId: mine } : {}) },
        _count: { _all: true },
      }),
      this.prisma.reservation.count({
        where: {
          companyId,
          deletedAt: null,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
          ...(mine ? { salesId: mine } : {}),
        },
      }),
      this.prisma.installment.aggregate({ where: this.overdueWhere(reps), _count: { _all: true }, _sum: { amount: true } }),
    ]);
    const out: Record<string, unknown> = {
      scope: reps ? (this.actor.role === UserRole.SALES ? 'own work' : 'team') : 'whole company',
      unitsByStatus: Object.fromEntries(units.map((u) => [u.status, u._count._all])),
      openLeadsByStage: Object.fromEntries(leads.map((l) => [l.stage, l._count._all])),
      openReservations,
      overdueInstallments: { count: overdue._count._all, amount: money(overdue._sum.amount) ?? 0 },
    };
    if (this.canSeeCompany) {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const where: Prisma.ContractWhereInput = {
        companyId,
        ...LIVE_CONTRACT_WHERE,
        signedAt: { gte: monthStart },
        ...(reps ? { reservation: { salesId: { in: reps } } } : {}),
      };
      const [count, value] = await Promise.all([this.prisma.contract.count({ where }), netContractValue(this.prisma, where)]);
      out.contractsSignedThisMonth = { count, netValue: money(value) };
    }
    return out;
  }

  private async overdue(input: Record<string, unknown>) {
    const rows = await this.prisma.installment.findMany({
      where: this.overdueWhere(await this.reps()),
      orderBy: { dueDate: 'asc' },
      take: limitOf(input.limit),
      select: {
        amount: true,
        dueDate: true,
        type: true,
        plan: {
          select: {
            contract: {
              select: {
                contractNumber: true,
                customer: { select: { fullName: true, phone: true } },
                unit: { select: { code: true, building: { select: { phase: { select: { project: { select: { name: true } } } } } } } },
              },
            },
          },
        },
      },
    });
    const now = Date.now();
    return rows.map((r) => ({
      customer: r.plan.contract.customer?.fullName ?? null,
      phone: r.plan.contract.customer?.phone ?? null,
      contract: r.plan.contract.contractNumber,
      unit: r.plan.contract.unit?.code ?? null,
      project: text(r.plan.contract.unit?.building?.phase?.project?.name),
      kind: r.type,
      amount: money(r.amount),
      dueDate: r.dueDate.toISOString().slice(0, 10),
      daysLate: Math.max(0, Math.floor((now - r.dueDate.getTime()) / DAY)),
    }));
  }

  private async units(input: Record<string, unknown>) {
    const status = oneOf(input.status, Object.values(UnitStatus));
    const project = typeof input.project === 'string' ? input.project.trim() : '';
    const rows = await this.prisma.unit.findMany({
      where: {
        companyId: this.actor.companyId,
        ...(status ? { status } : {}),
        ...(Number.isFinite(Number(input.minBedrooms)) && input.minBedrooms !== undefined ? { bedrooms: { gte: Number(input.minBedrooms) } } : {}),
        ...(Number.isFinite(Number(input.maxPrice)) && input.maxPrice !== undefined ? { price: { lte: Number(input.maxPrice) } } : {}),
      },
      orderBy: [{ price: 'asc' }],
      take: project ? 200 : limitOf(input.limit),
      select: {
        code: true,
        type: true,
        area: true,
        bedrooms: true,
        price: true,
        status: true,
        building: { select: { phase: { select: { project: { select: { name: true } } } } } },
      },
    });
    const list = rows.map((u) => ({
      code: u.code,
      project: text(u.building?.phase?.project?.name),
      type: u.type,
      area: u.area,
      bedrooms: u.bedrooms,
      price: money(u.price),
      status: u.status,
    }));
    const q = project.toLowerCase();
    return (q ? list.filter((u) => u.project.toLowerCase().includes(q)) : list).slice(0, limitOf(input.limit));
  }

  private async leads(input: Record<string, unknown>) {
    const reps = await this.reps();
    const stage = oneOf(input.stage, Object.values(LeadStage));
    const unassigned = input.unassigned === true && this.canSeeCompany;
    const rows = await this.prisma.lead.findMany({
      where: {
        companyId: this.actor.companyId,
        ...(stage ? { stage } : {}),
        ...(unassigned
          ? { assignedSalesId: null }
          : reps
            ? { assignedSalesId: { in: reps } }
            : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limitOf(input.limit),
      select: { fullName: true, phone: true, stage: true, createdAt: true, assignedSales: { select: { fullName: true } } },
    });
    return rows.map((l) => ({
      name: l.fullName,
      phone: l.phone,
      stage: l.stage,
      rep: l.assignedSales?.fullName ?? null,
      created: l.createdAt.toISOString().slice(0, 10),
    }));
  }

  private async reservations(input: Record<string, unknown>) {
    const reps = await this.reps();
    const status = oneOf(input.status, Object.values(ReservationStatus));
    const rows = await this.prisma.reservation.findMany({
      where: {
        companyId: this.actor.companyId,
        deletedAt: null,
        status: status ?? { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
        ...(reps ? { salesId: { in: reps } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limitOf(input.limit),
      select: {
        reservationNumber: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        unit: { select: { code: true } },
        client: { select: { fullName: true } },
        lead: { select: { fullName: true } },
        sales: { select: { fullName: true } },
      },
    });
    return rows.map((r) => ({
      number: r.reservationNumber,
      unit: r.unit?.code ?? null,
      client: r.client?.fullName ?? r.lead?.fullName ?? null,
      rep: r.sales?.fullName ?? null,
      status: r.status,
      created: r.createdAt.toISOString().slice(0, 10),
      expires: r.expiresAt.toISOString().slice(0, 10),
    }));
  }

  private async visits(input: Record<string, unknown>) {
    const reps = await this.reps();
    const days = Math.min(14, Math.max(1, Number.isInteger(Number(input.days)) ? Number(input.days) : 1));
    const now = new Date();
    const rows = await this.prisma.visitAppointment.findMany({
      where: {
        companyId: this.actor.companyId,
        scheduledAt: { gte: now, lte: new Date(now.getTime() + days * DAY) },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'PENDING_RESCHEDULE'] },
        ...(reps ? { assignedSalesId: { in: reps } } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
      take: MAX_ROWS,
      select: {
        scheduledAt: true,
        status: true,
        lead: { select: { fullName: true, phone: true } },
        client: { select: { fullName: true } },
        project: { select: { name: true } },
        assignedSales: { select: { fullName: true } },
      },
    });
    return rows.map((v) => ({
      at: v.scheduledAt.toISOString(),
      client: v.lead?.fullName ?? v.client?.fullName ?? null,
      phone: v.lead?.phone ?? null,
      project: text(v.project?.name),
      rep: v.assignedSales?.fullName ?? null,
      status: v.status,
    }));
  }
}
