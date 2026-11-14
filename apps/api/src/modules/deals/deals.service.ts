import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClaimStatus,
  DealStatus,
  LeadStage,
  ListingKind,
  ListingStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { findTenantUser } from '../../common/tenant/resolve-tenant-entity';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { currentCompanyTimeZone, startOfLocalToday } from '../../common/time/company-timezone';
import { assertLeadInScope, clientOwnerScope } from '../../common/utils/client-ownership';
import { paginate, takeSkip, toCounts } from '../../common/utils/pagination';
import { day } from '../listings/brokerage-terms';
import { NotificationsService } from '../notifications/notifications.module';
import { claimStatus, planSplits, round2 } from './deal-math';
import { monthKey } from './deal-report';
import { DealTargetsService } from './deal-targets.service';
import {
  CancelDealDto,
  CreateDealDto,
  RecordClaimPaymentDto,
  RecordCommissionDto,
  RejectClaimDto,
  SetCommissionRuleDto,
  SubmitClaimDto,
} from './dto/deal.dto';

export interface DealQuery {
  status?: DealStatus[];
  kind?: ListingKind[];
  q?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}

const PERSON = { select: { id: true, fullName: true } } as const;
const LISTING = {
  select: { id: true, code: true, title: true, kind: true, status: true },
} as const;
const DEAL_INCLUDE = {
  agent: PERSON,
  listing: LISTING,
  lead: { select: { id: true, fullName: true, phone: true, stage: true } },
  splits: { include: { user: PERSON }, orderBy: { role: 'asc' } },
  claim: { include: { payments: { orderBy: { receivedOn: 'asc' } } } },
} satisfies Prisma.DealInclude;

type Tx = Prisma.TransactionClient;
const num = (d: Prisma.Decimal | number | null | undefined) =>
  d === null || d === undefined ? 0 : Number(d);

/**
 * BRK-3 — a brokerage company's closed deals: who sold what, the commission
 * the company earns on it, the staff shares of that commission (from the
 * company's rules), what a developer owes on a primary sale (its claim) and
 * what has been collected and paid out.
 *
 * A rep sees the deals they made or share in; a sales manager also their
 * team's; the admin all. Every query runs in the tenant context.
 */
@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly targets: DealTargetsService,
  ) {}

  private async today(): Promise<Date> {
    return startOfLocalToday(await currentCompanyTimeZone(this.prisma, getRequiredCompanyId()));
  }

  /** The deals the caller may see: null for the admin. */
  private async visibleWhere(user: AuthUser): Promise<Prisma.DealWhereInput | null> {
    const scope = await clientOwnerScope(this.prisma, user);
    if (scope === null) return null;
    return { OR: [{ agentId: { in: scope } }, { splits: { some: { userId: user.sub } } }] };
  }

  // ── Deals ────────────────────────────────────────────────────────────────

  async list(user: AuthUser, query: DealQuery) {
    const scope = await this.visibleWhere(user);
    const q = query.q?.trim();
    const base: Prisma.DealWhereInput = {
      AND: [
        ...(scope ? [scope] : []),
        ...(query.agentId ? [{ agentId: query.agentId }] : []),
        ...(q
          ? [
              {
                OR: [
                  { code: { contains: q, mode: 'insensitive' as const } },
                  { customerName: { contains: q, mode: 'insensitive' as const } },
                  { customerPhone: { contains: q } },
                  { listing: { title: { contains: q, mode: 'insensitive' as const } } },
                  { listing: { code: { contains: q, mode: 'insensitive' as const } } },
                ],
              },
            ]
          : []),
      ],
    };
    const where: Prisma.DealWhereInput = {
      ...base,
      ...(query.kind?.length ? { kind: { in: query.kind } } : {}),
      ...(query.status?.length ? { status: { in: query.status } } : {}),
    };
    const p = { page: query.page ?? 1, pageSize: query.pageSize ?? 25 };
    const closedWhere: Prisma.DealWhereInput = {
      ...base,
      status: DealStatus.CLOSED,
      ...(query.kind?.length ? { kind: { in: query.kind } } : {}),
    };
    const [data, total, byKind, byStatus, sums] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        orderBy: [{ closedOn: 'desc' }, { createdAt: 'desc' }],
        ...takeSkip(p),
        include: {
          agent: PERSON,
          listing: LISTING,
          claim: { select: { id: true, code: true, status: true } },
        },
      }),
      this.prisma.deal.count({ where }),
      this.prisma.deal.groupBy({
        by: ['kind'],
        where: { ...base, ...(query.status?.length ? { status: { in: query.status } } : {}) },
        _count: true,
      }),
      this.prisma.deal.groupBy({
        by: ['status'],
        where: { ...base, ...(query.kind?.length ? { kind: { in: query.kind } } : {}) },
        _count: true,
      }),
      // The headline figures count closed deals only: a cancelled deal earns nothing.
      this.prisma.deal.aggregate({
        where: closedWhere,
        _sum: { dealValue: true, commissionTotal: true, commissionReceived: true },
        _count: true,
      }),
    ]);
    const dec = (d: Prisma.Decimal | null) => d ?? new Prisma.Decimal(0);
    return paginate(data, total, p, {
      counts: {
        kind: toCounts(byKind.map((g) => [String(g.kind), g._count] as const)),
        status: toCounts(byStatus.map((g) => [String(g.status), g._count] as const)),
      },
      // Closed deals only: a cancelled deal earns nothing.
      sums: {
        dealValue: dec(sums._sum.dealValue).toFixed(2),
        commission: dec(sums._sum.commissionTotal).toFixed(2),
        received: dec(sums._sum.commissionReceived).toFixed(2),
        outstanding: dec(sums._sum.commissionTotal)
          .minus(dec(sums._sum.commissionReceived))
          .toFixed(2),
      },
    });
  }

  async get(user: AuthUser, id: string) {
    const scope = await this.visibleWhere(user);
    const deal = await this.prisma.deal.findFirst({
      where: { id, ...(scope ?? {}) },
      include: DEAL_INCLUDE,
    });
    if (!deal) throw new NotFoundException('الصفقة غير موجودة');
    return deal;
  }

  /** The commission rule in force for each kind; a kind without one shares nothing. */
  async rules() {
    const rows = await this.prisma.commissionRule.findMany();
    return [ListingKind.PRIMARY, ListingKind.RESALE, ListingKind.RENT].map((kind) => {
      const r = rows.find((x) => x.kind === kind);
      return {
        kind,
        agentPct: num(r?.agentPct),
        managerPct: num(r?.managerPct),
        updatedAt: r?.updatedAt ?? null,
      };
    });
  }

  async setRule(kind: ListingKind, dto: SetCommissionRuleDto) {
    if (dto.agentPct + dto.managerPct > 100)
      throw new BadRequestException('مجموع النسب لا يزيد عن 100%');
    const companyId = getRequiredCompanyId();
    await this.prisma.commissionRule.upsert({
      where: { companyId_kind: { companyId, kind } },
      create: { kind, agentPct: dto.agentPct, managerPct: dto.managerPct, companyId },
      update: { agentPct: dto.agentPct, managerPct: dto.managerPct },
    });
    return this.rules();
  }

  async create(user: AuthUser, dto: CreateDealDto) {
    const today = await this.today();
    const closedOn = day(dto.closedOn);
    if (closedOn.getTime() > today.getTime())
      throw new BadRequestException('تاريخ الإغلاق لا يكون في المستقبل');
    if (dto.commissionTotal > dto.dealValue)
      throw new BadRequestException('العمولة أكبر من قيمة الصفقة');

    const listing = dto.listingId
      ? await this.prisma.listing.findFirst({
          where: { id: dto.listingId },
          select: {
            id: true,
            code: true,
            title: true,
            kind: true,
            status: true,
            agentId: true,
            developerName: true,
          },
        })
      : null;
    if (dto.listingId && !listing) throw new BadRequestException('الوحدة غير موجودة');
    if (listing?.status === ListingStatus.WITHDRAWN)
      throw new BadRequestException('الوحدة مسحوبة من العرض');
    if (
      listing &&
      (await this.prisma.deal.count({
        where: { listingId: listing.id, status: DealStatus.CLOSED },
      })) > 0
    ) {
      throw new ConflictException('هذه الوحدة لها صفقة مسجّلة بالفعل — ألغِها أولاً');
    }
    const kind = listing?.kind ?? dto.kind;
    if (!kind) throw new BadRequestException('نوع الصفقة مطلوب');
    const developerName = dto.developerName?.trim() || listing?.developerName || null;
    if (kind === ListingKind.PRIMARY && !developerName)
      throw new BadRequestException('اسم المطوّر مطلوب لصفقة البيع الأولي');

    const scope = await clientOwnerScope(this.prisma, user);
    const lead = dto.leadId
      ? await this.prisma.lead.findFirst({
          where: { id: dto.leadId },
          select: { id: true, fullName: true, phone: true, stage: true, assignedSalesId: true },
        })
      : null;
    if (dto.leadId) {
      if (!lead) throw new BadRequestException('Lead not found');
      assertLeadInScope(scope, lead.assignedSalesId);
    }
    const customerName = dto.customerName?.trim() || lead?.fullName;
    if (!customerName) throw new BadRequestException('اسم العميل مطلوب');

    // A rep records their own deals; a manager their team's; the admin anyone's.
    const agentId =
      user.role === UserRole.SALES
        ? user.sub
        : (dto.agentId ?? listing?.agentId ?? lead?.assignedSalesId ?? null);
    const agent = agentId
      ? await findTenantUser(this.prisma, agentId, {
          id: true,
          role: true,
          managerId: true,
          active: true,
        })
      : null;
    if (
      agentId &&
      (!agent || !([UserRole.SALES, UserRole.SALES_MANAGER] as UserRole[]).includes(agent.role))
    ) {
      throw new BadRequestException('المندوب غير موجود');
    }
    if (agentId && scope !== null && !scope.includes(agentId))
      throw new BadRequestException('المندوب خارج فريقك');

    const ruleRow = await this.prisma.commissionRule.findFirst({ where: { kind } });
    const rule = ruleRow
      ? { agentPct: num(ruleRow.agentPct), managerPct: num(ruleRow.managerPct) }
      : null;
    // BRK-6b: an outside broker's share comes off the top; the team shares what is left.
    if (dto.coBrokerPct !== undefined && !dto.coBrokerName?.trim()) throw new BadRequestException('اسم الوسيط الشريك مطلوب');
    const coBrokerAmount = dto.coBrokerPct ? round2((dto.commissionTotal * dto.coBrokerPct) / 100) : 0;
    const splits = planSplits(round2(dto.commissionTotal - coBrokerAmount), rule, agentId, agent?.managerId ?? null);

    const companyId = getRequiredCompanyId();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const id = await this.prisma.$transaction(async (tx) => {
          const code = await nextCode(tx, 'deal', 'D');
          const deal = await tx.deal.create({
            data: {
              code,
              kind,
              status: DealStatus.CLOSED,
              listingId: listing?.id ?? null,
              leadId: lead?.id ?? null,
              customerName,
              customerPhone: dto.customerPhone?.trim() || lead?.phone || null,
              dealValue: dto.dealValue,
              closedOn,
              commissionTotal: dto.commissionTotal,
              coBrokerName: dto.coBrokerPct ? dto.coBrokerName!.trim() : null,
              coBrokerPhone: dto.coBrokerPct ? dto.coBrokerPhone?.trim() || null : null,
              coBrokerPct: dto.coBrokerPct ?? null,
              coBrokerAmount,
              agentId,
              notes: dto.notes?.trim() || null,
              createdById: user.sub,
              companyId,
            },
          });
          if (splits.length) {
            await tx.dealSplit.createMany({
              data: splits.map((s) => ({ ...s, dealId: deal.id, companyId })),
            });
          }
          if (kind === ListingKind.PRIMARY) {
            await tx.developerClaim.create({
              data: {
                code: await nextCode(tx, 'claim', 'CL'),
                dealId: deal.id,
                developerName: developerName!,
                amount: dto.commissionTotal,
                companyId,
              },
            });
          }
          if (listing && listing.status !== ListingStatus.CLOSED) {
            await tx.listing.updateMany({
              where: { id: listing.id },
              data: { status: ListingStatus.CLOSED },
            });
          }
          if (lead && lead.stage !== LeadStage.WON) {
            await tx.lead.update({ where: { id: lead.id }, data: { stage: LeadStage.WON } });
            await tx.leadActivity.create({
              data: {
                leadId: lead.id,
                type: 'status_change',
                payload: { from: lead.stage, to: LeadStage.WON, reason: `Deal ${code} closed` },
                companyId,
              },
            });
          }
          return deal.id;
        });
        // BRK-4: the deal may complete the agent's month.
        await this.targets.checkAchieved(agentId, monthKey(closedOn));
        return this.get(user, id);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          attempt < 2
        )
          continue;
        throw err;
      }
    }
    throw new BadRequestException('تعذّر حفظ الصفقة، حاول مرة أخرى');
  }

  /**
   * Undo a deal recorded by mistake or that fell through. Refused once money
   * moved on it (commission collected or a share paid out). The listing goes
   * back on the market and the lead back to negotiation.
   */
  async cancel(user: AuthUser, id: string, dto: CancelDealDto) {
    const deal = await this.get(user, id);
    if (deal.status === DealStatus.CANCELLED) throw new ConflictException('الصفقة ملغاة بالفعل');
    if (num(deal.commissionReceived) > 0 || (deal.claim?.payments.length ?? 0) > 0) {
      throw new ConflictException('تم تحصيل عمولة على هذه الصفقة — احذف التحصيل أولاً');
    }
    if (deal.splits.some((s) => s.paidAt))
      throw new ConflictException('تم صرف عمولة لأحد الموظفين على هذه الصفقة');

    await this.prisma.$transaction(async (tx) => {
      const done = await tx.deal.updateMany({
        where: { id, status: DealStatus.CLOSED },
        data: {
          status: DealStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.reason.trim(),
        },
      });
      if (done.count === 0) throw new ConflictException('الصفقة ملغاة بالفعل');
      await tx.dealSplit.deleteMany({ where: { dealId: id, paidAt: null } });
      if (deal.claim) await tx.developerClaim.deleteMany({ where: { id: deal.claim.id } });
      if (deal.listingId) {
        await tx.listing.updateMany({
          where: { id: deal.listingId, status: ListingStatus.CLOSED },
          data: { status: ListingStatus.AVAILABLE },
        });
      }
      if (deal.lead?.stage === LeadStage.WON) {
        await tx.lead.update({
          where: { id: deal.lead.id },
          data: { stage: LeadStage.NEGOTIATION },
        });
        await tx.leadActivity.create({
          data: {
            leadId: deal.lead.id,
            type: 'status_change',
            payload: {
              from: LeadStage.WON,
              to: LeadStage.NEGOTIATION,
              reason: `Deal ${deal.code} cancelled`,
            },
            companyId: getRequiredCompanyId(),
          },
        });
      }
    });
    return this.get(user, id);
  }

  /** What has been collected from the parties of a resale or rent deal. */
  async recordCommission(user: AuthUser, id: string, dto: RecordCommissionDto) {
    const deal = await this.get(user, id);
    if (deal.status !== DealStatus.CLOSED) throw new ConflictException('الصفقة ملغاة');
    if (deal.kind === ListingKind.PRIMARY)
      throw new BadRequestException('عمولة البيع الأولي تُحصَّل من مطالبة المطوّر');
    if (dto.commissionReceived > num(deal.commissionTotal))
      throw new BadRequestException('المحصَّل أكبر من العمولة');
    if (dto.commissionReceived < num(deal.commissionTotal) && (deal.splits.some((s) => s.paidAt) || deal.coBrokerPaidAt)) {
      throw new ConflictException('تم صرف عمولات على هذه الصفقة بعد تحصيلها بالكامل');
    }
    await this.prisma.deal.updateMany({
      where: { id },
      data: { commissionReceived: dto.commissionReceived },
    });
    return this.get(user, id);
  }

  // ── Developer claims ─────────────────────────────────────────────────────

  async claims(status?: ClaimStatus[]) {
    const where: Prisma.DeveloperClaimWhereInput = {
      deal: { status: DealStatus.CLOSED },
      ...(status?.length ? { status: { in: status } } : {}),
    };
    const [rows, byStatus, all] = await Promise.all([
      this.prisma.developerClaim.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          deal: {
            select: {
              id: true,
              code: true,
              customerName: true,
              closedOn: true,
              dealValue: true,
              listing: LISTING,
              agent: PERSON,
            },
          },
          payments: { orderBy: { receivedOn: 'asc' } },
        },
      }),
      this.prisma.developerClaim.groupBy({
        by: ['status'],
        where: { deal: { status: DealStatus.CLOSED } },
        _count: true,
      }),
      this.prisma.developerClaim.findMany({
        where: { deal: { status: DealStatus.CLOSED }, status: { not: ClaimStatus.REJECTED } },
        select: { amount: true, payments: { select: { amount: true } } },
      }),
    ]);
    const claimed = all.reduce((s, c) => s + num(c.amount), 0);
    const paid = all.reduce((s, c) => s + c.payments.reduce((x, p) => x + num(p.amount), 0), 0);
    return {
      data: rows.map((c) => ({
        ...c,
        paid: round2(c.payments.reduce((s, p) => s + num(p.amount), 0)),
      })),
      counts: toCounts(byStatus.map((g) => [String(g.status), g._count] as const)),
      totals: { claimed: round2(claimed), paid: round2(paid), outstanding: round2(claimed - paid) },
    };
  }

  private async claim(id: string) {
    const claim = await this.prisma.developerClaim.findFirst({
      where: { id },
      include: { payments: true, deal: { select: { id: true, status: true } } },
    });
    if (!claim) throw new NotFoundException('المطالبة غير موجودة');
    if (claim.deal.status !== DealStatus.CLOSED)
      throw new ConflictException('صفقة هذه المطالبة ملغاة');
    return claim;
  }

  /** Recompute a claim's status and its deal's collected commission from its payments. */
  private async settleClaim(tx: Tx, claimId: string, rejected?: boolean) {
    const c = await tx.developerClaim.findFirstOrThrow({
      where: { id: claimId },
      include: { payments: { select: { amount: true } } },
    });
    const paid = round2(c.payments.reduce((s, p) => s + num(p.amount), 0));
    const status = claimStatus({
      amount: num(c.amount),
      paid,
      submittedOn: c.submittedOn,
      rejected: rejected ?? c.status === ClaimStatus.REJECTED,
    });
    await tx.developerClaim.updateMany({ where: { id: claimId }, data: { status } });
    await tx.deal.updateMany({ where: { id: c.dealId }, data: { commissionReceived: paid } });
  }

  async submitClaim(id: string, dto: SubmitClaimDto) {
    const claim = await this.claim(id);
    if (claim.status === ClaimStatus.PAID) throw new ConflictException('المطالبة مدفوعة بالكامل');
    await this.prisma.$transaction(async (tx) => {
      await tx.developerClaim.updateMany({
        where: { id },
        data: {
          submittedOn: day(dto.submittedOn),
          ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        },
      });
      // Resubmitting a rejected claim reopens it.
      await this.settleClaim(tx, id, false);
    });
    return this.claims();
  }

  async rejectClaim(id: string, dto: RejectClaimDto) {
    const claim = await this.claim(id);
    if (claim.payments.length > 0) throw new ConflictException('تم استلام دفعات على هذه المطالبة');
    await this.prisma.developerClaim.updateMany({
      where: { id },
      data: { status: ClaimStatus.REJECTED, notes: dto.notes.trim() },
    });
    return this.claims();
  }

  async recordClaimPayment(user: AuthUser, id: string, dto: RecordClaimPaymentDto) {
    const claim = await this.claim(id);
    const paid = claim.payments.reduce((s, p) => s + num(p.amount), 0);
    const left = round2(num(claim.amount) - paid);
    if (dto.amount > left) throw new BadRequestException(`المتبقي على المطالبة ${left}`);
    const receivedOn = day(dto.receivedOn);
    if (receivedOn.getTime() > (await this.today()).getTime())
      throw new BadRequestException('تاريخ الاستلام لا يكون في المستقبل');
    await this.prisma.$transaction(async (tx) => {
      await tx.claimPayment.create({
        data: {
          claimId: id,
          amount: dto.amount,
          receivedOn,
          note: dto.note?.trim() || null,
          createdById: user.sub,
          companyId: getRequiredCompanyId(),
        },
      });
      // A payment means the claim was submitted, whether or not that was recorded.
      if (!claim.submittedOn)
        await tx.developerClaim.updateMany({ where: { id }, data: { submittedOn: receivedOn } });
      await this.settleClaim(tx, id, false);
    });
    return this.claims();
  }

  async removeClaimPayment(paymentId: string) {
    const payment = await this.prisma.claimPayment.findFirst({
      where: { id: paymentId },
      select: { id: true, claimId: true },
    });
    if (!payment) throw new NotFoundException('الدفعة غير موجودة');
    const claim = await this.claim(payment.claimId);
    const deal = await this.prisma.deal.findFirst({
      where: { id: claim.dealId },
      select: { coBrokerPaidAt: true, splits: { select: { paidAt: true } } },
    });
    if (deal?.coBrokerPaidAt || deal?.splits.some((s) => s.paidAt))
      throw new ConflictException('تم صرف عمولات على هذه الصفقة بعد تحصيلها');
    await this.prisma.$transaction(async (tx) => {
      await tx.claimPayment.deleteMany({ where: { id: paymentId } });
      await this.settleClaim(tx, payment.claimId);
    });
    return this.claims();
  }

  // ── Staff shares (payouts) ───────────────────────────────────────────────

  /**
   * The staff shares of closed deals. The finance user sees everyone's; any
   * other caller only their own. A share is payable once the deal's whole
   * commission has been collected.
   */
  async splits(
    user: AuthUser,
    canSeeAll: boolean,
    query: { userId?: string; state?: 'unpaid' | 'paid' },
  ) {
    const userId = canSeeAll ? query.userId : user.sub;
    const rows = await this.prisma.dealSplit.findMany({
      where: {
        deal: { status: DealStatus.CLOSED },
        ...(userId ? { userId } : {}),
        ...(query.state === 'paid'
          ? { paidAt: { not: null } }
          : query.state === 'unpaid'
            ? { paidAt: null }
            : {}),
      },
      orderBy: [{ paidAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
      include: {
        user: PERSON,
        deal: {
          select: {
            id: true,
            code: true,
            kind: true,
            customerName: true,
            closedOn: true,
            commissionTotal: true,
            commissionReceived: true,
            listing: LISTING,
          },
        },
      },
      take: 500,
    });
    const data = rows.map((s) => ({
      ...s,
      payable: !s.paidAt && num(s.deal.commissionReceived) >= num(s.deal.commissionTotal),
    }));
    const sum = (f: (s: (typeof data)[number]) => boolean) =>
      round2(data.filter(f).reduce((t, s) => t + num(s.amount), 0));
    return {
      data,
      totals: {
        payable: sum((s) => s.payable),
        awaitingCollection: sum((s) => !s.paidAt && !s.payable),
        paid: sum((s) => !!s.paidAt),
      },
    };
  }

  async paySplit(id: string) {
    const split = await this.prisma.dealSplit.findFirst({
      where: { id },
      include: {
        deal: {
          select: {
            id: true,
            code: true,
            status: true,
            commissionTotal: true,
            commissionReceived: true,
          },
        },
      },
    });
    if (!split) throw new NotFoundException('العمولة غير موجودة');
    if (split.deal.status !== DealStatus.CLOSED) throw new ConflictException('الصفقة ملغاة');
    if (split.paidAt) throw new ConflictException('تم صرف هذه العمولة بالفعل');
    if (num(split.deal.commissionReceived) < num(split.deal.commissionTotal)) {
      throw new ConflictException('لم تُحصَّل عمولة الصفقة بالكامل بعد');
    }
    const done = await this.prisma.dealSplit.updateMany({
      where: { id, paidAt: null },
      data: { paidAt: new Date() },
    });
    if (done.count === 0) throw new ConflictException('تم صرف هذه العمولة بالفعل');
    await this.notifications.sendToUsers([split.userId], 'deal_commission_paid', {
      entityType: 'deal',
      entityId: split.deal.id,
      dealCode: split.deal.code,
      amount: num(split.amount),
    });
    return { ok: true };
  }

  /** BRK-6b — pay the outside broker their share, once the deal's commission is collected. */
  async payCoBroker(user: AuthUser, id: string) {
    const deal = await this.get(user, id);
    if (deal.status !== DealStatus.CLOSED) throw new ConflictException('الصفقة ملغاة');
    if (!deal.coBrokerName || num(deal.coBrokerAmount) <= 0) throw new BadRequestException('لا وسيط شريك على هذه الصفقة');
    if (num(deal.commissionReceived) < num(deal.commissionTotal)) throw new ConflictException('لم تُحصَّل عمولة الصفقة بالكامل بعد');
    const done = await this.prisma.deal.updateMany({ where: { id, coBrokerPaidAt: null }, data: { coBrokerPaidAt: new Date() } });
    if (done.count === 0) throw new ConflictException('تم صرف نصيب الوسيط بالفعل');
    return this.get(user, id);
  }

  async unpayCoBroker(user: AuthUser, id: string) {
    await this.get(user, id);
    const done = await this.prisma.deal.updateMany({ where: { id, coBrokerPaidAt: { not: null } }, data: { coBrokerPaidAt: null } });
    if (done.count === 0) throw new NotFoundException('نصيب الوسيط غير مصروف');
    return this.get(user, id);
  }

  async unpaySplit(id: string) {
    const done = await this.prisma.dealSplit.updateMany({
      where: { id, paidAt: { not: null } },
      data: { paidAt: null },
    });
    if (done.count === 0) throw new NotFoundException('العمولة غير مصروفة');
    return { ok: true };
  }
}

/** The next "<prefix>-0001" code of the company's deals or claims. */
async function nextCode(tx: Tx, model: 'deal' | 'claim', prefix: string): Promise<string> {
  const rows =
    model === 'deal'
      ? await tx.deal.findMany({ select: { code: true } })
      : await tx.developerClaim.findMany({ select: { code: true } });
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const max = rows.reduce((m, r) => Math.max(m, Number(re.exec(r.code)?.[1] ?? 0)), 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}
