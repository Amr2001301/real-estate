import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EoiStatus, LaunchStatus, LeadStage, Prisma, UserRole } from '@prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { findTenantUser } from '../../common/tenant/resolve-tenant-entity';
import { assertLeadInScope, clientOwnerScope } from '../../common/utils/client-ownership';
import { NotificationsService } from '../notifications/notifications.module';
import {
  AllocateEoiDto,
  CreateEoiDto,
  CreateLaunchDto,
  PayEoiDto,
  UpdateLaunchDto,
} from './dto/launch.dto';

const num = (d: Prisma.Decimal | null | undefined) =>
  d === null || d === undefined ? 0 : Number(d);
const day = (v: string) => new Date(`${v.slice(0, 10)}T00:00:00.000Z`);
/** EOIs holding a place in the queue, in the order they paid. */
const QUEUED: EoiStatus[] = [EoiStatus.PAID, EoiStatus.ALLOCATED];
const PERSON = { select: { id: true, fullName: true } } as const;

/**
 * BRK-6 — the developers' launches the brokerage collects expressions of
 * interest (EOIs) for. A paid EOI holds a place in the launch's queue, by
 * payment time; at the launch it is allocated a unit or refunded.
 *
 * Every sales role records EOIs; a rep sees their own, a manager the team's,
 * the admin all. The admin and managers run the launch and the money.
 */
@Injectable()
export class LaunchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async eoiScope(user: AuthUser): Promise<Prisma.LaunchEoiWhereInput> {
    const scope = await clientOwnerScope(this.prisma, user);
    return scope === null ? {} : { agentId: { in: scope } };
  }

  async list() {
    const launches = await this.prisma.launch.findMany({
      orderBy: [{ launchDate: 'desc' }],
      include: { developerProject: { select: { id: true, name: true } } },
    });
    const stats = await this.prisma.launchEoi.groupBy({
      by: ['launchId', 'status'],
      _count: true,
      _sum: { amount: true },
    });
    return launches.map((l) => {
      const rows = stats.filter((s) => s.launchId === l.id);
      const count = (st: EoiStatus[]) =>
        rows.filter((r) => st.includes(r.status)).reduce((n, r) => n + r._count, 0);
      const held = rows
        .filter((r) => r.status === EoiStatus.PAID || r.status === EoiStatus.ALLOCATED)
        .reduce((n, r) => n + num(r._sum.amount), 0);
      return {
        ...l,
        counts: {
          total: count(Object.values(EoiStatus)),
          pending: count([EoiStatus.PENDING_PAYMENT]),
          paid: count([EoiStatus.PAID]),
          allocated: count([EoiStatus.ALLOCATED]),
          refunded: count([EoiStatus.REFUNDED]),
        },
        held,
      };
    });
  }

  private async launch(id: string) {
    const l = await this.prisma.launch.findFirst({
      where: { id },
      include: { developerProject: { select: { id: true, name: true } } },
    });
    if (!l) throw new NotFoundException('الإطلاق غير موجود');
    return l;
  }

  /** A launch with the caller's EOIs, each with its place in the queue. */
  async get(user: AuthUser, id: string) {
    const l = await this.launch(id);
    const [all, mine] = await Promise.all([
      this.prisma.launchEoi.findMany({
        where: { launchId: id, status: { in: QUEUED } },
        orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      }),
      this.prisma.launchEoi.findMany({
        where: { launchId: id, ...(await this.eoiScope(user)) },
        orderBy: [{ paidAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
        include: { agent: PERSON, lead: { select: { id: true, fullName: true } } },
      }),
    ]);
    const place = new Map(all.map((e, i) => [e.id, i + 1]));
    return {
      ...l,
      queueLength: all.length,
      eois: mine.map((e) => ({ ...e, queue: place.get(e.id) ?? null })),
    };
  }

  private async resolveProject(id: string) {
    const p = await this.prisma.developerProject.findFirst({
      where: { id },
      select: { id: true, developer: { select: { name: true } } },
    });
    if (!p) throw new BadRequestException('المشروع غير موجود');
    return p;
  }

  async create(dto: CreateLaunchDto) {
    const project = dto.developerProjectId
      ? await this.resolveProject(dto.developerProjectId)
      : null;
    const developerName = dto.developerName?.trim() || project?.developer.name;
    if (!developerName) throw new BadRequestException('اسم المطوّر مطلوب');
    return this.prisma.launch.create({
      data: {
        name: dto.name.trim(),
        developerProjectId: project?.id ?? null,
        developerName,
        launchDate: day(dto.launchDate),
        eoiAmount: dto.eoiAmount,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async update(id: string, dto: UpdateLaunchDto) {
    await this.launch(id);
    const project = dto.developerProjectId
      ? await this.resolveProject(dto.developerProjectId)
      : null;
    await this.prisma.launch.updateMany({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.developerProjectId !== undefined
          ? { developerProjectId: project?.id ?? null }
          : {}),
        ...(dto.developerName !== undefined && dto.developerName.trim()
          ? { developerName: dto.developerName.trim() }
          : project
            ? { developerName: project.developer.name }
            : {}),
        ...(dto.launchDate !== undefined ? { launchDate: day(dto.launchDate) } : {}),
        ...(dto.eoiAmount !== undefined ? { eoiAmount: dto.eoiAmount } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    return this.launch(id);
  }

  // ── EOIs ─────────────────────────────────────────────────────────────────

  async createEoi(user: AuthUser, launchId: string, dto: CreateEoiDto) {
    const l = await this.launch(launchId);
    if (l.status === LaunchStatus.CLOSED) throw new ConflictException('الإطلاق مغلق');
    const scope = await clientOwnerScope(this.prisma, user);
    const lead = dto.leadId
      ? await this.prisma.lead.findFirst({
          where: { id: dto.leadId },
          select: { id: true, fullName: true, phone: true, assignedSalesId: true },
        })
      : null;
    if (dto.leadId) {
      if (!lead) throw new BadRequestException('Lead not found');
      assertLeadInScope(scope, lead.assignedSalesId);
    }
    // A rep records for themself; a manager for the team; the admin for anyone.
    const agentId =
      user.role === UserRole.SALES ? user.sub : (dto.agentId ?? lead?.assignedSalesId ?? user.sub);
    const agent = await findTenantUser(this.prisma, agentId, { id: true, role: true });
    if (
      !agent ||
      !([UserRole.SALES, UserRole.SALES_MANAGER, UserRole.ADMIN] as UserRole[]).includes(agent.role)
    )
      throw new BadRequestException('المندوب غير موجود');
    if (scope !== null && !scope.includes(agentId))
      throw new BadRequestException('المندوب خارج فريقك');
    if (
      lead &&
      (await this.prisma.launchEoi.count({
        where: {
          launchId,
          leadId: lead.id,
          status: { in: [EoiStatus.PENDING_PAYMENT, ...QUEUED] },
        },
      })) > 0
    ) {
      throw new ConflictException('لهذا العميل طلب اهتمام قائم في هذا الإطلاق');
    }
    return this.prisma.launchEoi.create({
      data: {
        launchId,
        leadId: lead?.id ?? null,
        customerName: dto.customerName?.trim() || lead!.fullName,
        customerPhone: dto.customerPhone?.trim() || lead!.phone,
        preference: dto.preference?.trim() || null,
        budget: dto.budget ?? null,
        amount: l.eoiAmount,
        agentId,
        notes: dto.notes?.trim() || null,
        createdById: user.sub,
      },
    });
  }

  private async eoi(user: AuthUser, id: string) {
    const e = await this.prisma.launchEoi.findFirst({
      where: { id, ...(await this.eoiScope(user)) },
      include: { launch: { select: { id: true, name: true, status: true } } },
    });
    if (!e) throw new NotFoundException('طلب الاهتمام غير موجود');
    return e;
  }

  /** The amount was received: the EOI takes its place in the queue. */
  async pay(user: AuthUser, id: string, dto: PayEoiDto) {
    const e = await this.eoi(user, id);
    if (e.status !== EoiStatus.PENDING_PAYMENT)
      throw new ConflictException('سُجّل دفع هذا الطلب بالفعل');
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (paidAt.getTime() > Date.now() + 60_000)
      throw new BadRequestException('تاريخ الدفع لا يكون في المستقبل');
    await this.prisma.launchEoi.updateMany({
      where: { id, status: EoiStatus.PENDING_PAYMENT },
      data: { status: EoiStatus.PAID, paidAt, paymentRef: dto.paymentRef?.trim() || null },
    });
    return { ok: true };
  }

  /** At the launch: the unit the customer got. The lead moves on to negotiation. */
  async allocate(user: AuthUser, id: string, dto: AllocateEoiDto) {
    const e = await this.eoi(user, id);
    if (e.status !== EoiStatus.PAID) throw new ConflictException('يُخصَّص للطلبات المدفوعة فقط');
    await this.prisma.launchEoi.updateMany({
      where: { id, status: EoiStatus.PAID },
      data: { status: EoiStatus.ALLOCATED, allocation: dto.allocation.trim() },
    });
    if (e.leadId) {
      await this.prisma.lead.updateMany({
        where: {
          id: e.leadId,
          stage: { in: [LeadStage.NEW, LeadStage.INTERESTED, LeadStage.VISIT] },
        },
        data: { stage: LeadStage.NEGOTIATION },
      });
    }
    await this.notifications.sendToUsers(
      [e.agentId],
      'eoi_allocated',
      {
        entityType: 'launch',
        entityId: e.launchId,
        customerName: e.customerName,
        launchName: e.launch.name,
        allocation: dto.allocation.trim(),
      },
      { except: user.sub },
    );
    return { ok: true };
  }

  async refund(user: AuthUser, id: string) {
    const e = await this.eoi(user, id);
    if (e.status !== EoiStatus.PAID)
      throw new ConflictException('يُرَد المبلغ للطلبات المدفوعة غير المخصّصة فقط');
    await this.prisma.launchEoi.updateMany({
      where: { id, status: EoiStatus.PAID },
      data: { status: EoiStatus.REFUNDED, refundedAt: new Date() },
    });
    return { ok: true };
  }

  async cancel(user: AuthUser, id: string) {
    const e = await this.eoi(user, id);
    if (e.status !== EoiStatus.PENDING_PAYMENT)
      throw new ConflictException('يُلغى الطلب قبل الدفع فقط — بعده يُرَد المبلغ');
    await this.prisma.launchEoi.updateMany({
      where: { id, status: EoiStatus.PENDING_PAYMENT },
      data: { status: EoiStatus.CANCELLED },
    });
    return { ok: true };
  }
}
