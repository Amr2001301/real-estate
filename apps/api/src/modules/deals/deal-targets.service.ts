import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DealStatus, Prisma, UserRole } from '@prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { findTenantUser, scopedUserFindMany } from '../../common/tenant/resolve-tenant-entity';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { currentCompanyTimeZone, startOfLocalToday } from '../../common/time/company-timezone';
import { clientOwnerScope } from '../../common/utils/client-ownership';
import { NotificationsService } from '../notifications/notifications.module';
import {
  buildReport,
  monthBounds,
  monthKey,
  monthsBetween,
  PERIOD_RE,
  shiftMonth,
  targetProgress,
} from './deal-report';
import { SetTargetDto } from './dto/deal.dto';

const num = (d: Prisma.Decimal | number | null | undefined) =>
  d === null || d === undefined ? 0 : Number(d);
const SALES_SIDE: UserRole[] = [UserRole.SALES, UserRole.SALES_MANAGER];

/**
 * BRK-4 — the brokerage's financial report and its agents' monthly targets
 * and target bonuses. The report is the admin's; a target's progress is seen
 * by the agent (their own), their manager (the team) and the admin (all).
 */
@Injectable()
export class DealTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** This month in the company's time zone. */
  async currentPeriod(): Promise<string> {
    return monthKey(
      startOfLocalToday(await currentCompanyTimeZone(this.prisma, getRequiredCompanyId())),
    );
  }

  private assertPeriod(p: string) {
    if (!PERIOD_RE.test(p)) throw new BadRequestException('الشهر يكون بصيغة YYYY-MM');
  }

  // ── Report ───────────────────────────────────────────────────────────────

  async report(fromArg?: string, toArg?: string) {
    const now = await this.currentPeriod();
    const to = toArg ?? now;
    const from = fromArg ?? to;
    this.assertPeriod(from);
    this.assertPeriod(to);
    if (from > to) throw new BadRequestException('بداية الفترة بعد نهايتها');
    if (monthsBetween(from, to).length > 36)
      throw new BadRequestException('الفترة لا تزيد عن 36 شهرًا');

    // The trend shows the 12 months ending with the period.
    const trendMonths = monthsBetween(shiftMonth(to, 11), to);
    const loadFrom = from < trendMonths[0]! ? from : trendMonths[0]!;
    const window = { gte: monthBounds(loadFrom).start, lt: monthBounds(to).end };

    const [deals, splits, targets] = await Promise.all([
      this.prisma.deal.findMany({
        where: { status: DealStatus.CLOSED, closedOn: window },
        select: {
          kind: true,
          closedOn: true,
          agentId: true,
          dealValue: true,
          commissionTotal: true,
          commissionReceived: true,
        },
      }),
      this.prisma.dealSplit.findMany({
        where: { deal: { status: DealStatus.CLOSED, closedOn: window } },
        select: { userId: true, amount: true, paidAt: true, deal: { select: { closedOn: true } } },
      }),
      this.prisma.brokerageTarget.findMany({ where: { period: { gte: from, lte: to } } }),
    ]);
    const report = buildReport(
      deals.map((d) => ({
        ...d,
        dealValue: num(d.dealValue),
        commissionTotal: num(d.commissionTotal),
        commissionReceived: num(d.commissionReceived),
      })),
      splits.map((s) => ({
        userId: s.userId,
        closedOn: s.deal.closedOn,
        amount: num(s.amount),
        paid: !!s.paidAt,
      })),
      from,
      to,
      trendMonths,
    );

    // The agents' names, and their bonuses for the period.
    const ids = [
      ...new Set([...report.byAgent.map((a) => a.userId), ...targets.map((t) => t.userId)]),
    ];
    const people = ids.length
      ? await scopedUserFindMany(
          this.prisma,
          { id: { in: ids } },
          { id: true, fullName: true, role: true },
        )
      : [];
    const name = new Map(people.map((p) => [p.id, p]));
    const actual = await this.actuals(targets.map((t) => t.period));
    const bonuses = targets.map((t) => {
      const a = actual.get(`${t.userId}|${t.period}`) ?? { commission: 0, deals: 0 };
      return {
        ...t,
        achieved: targetProgress(
          { commissionTarget: num(t.commissionTarget), dealsTarget: t.dealsTarget },
          a,
        ).achieved,
      };
    });
    const earned = bonuses.filter((b) => b.achieved);
    const bonusTotal = earned.reduce((s, b) => s + num(b.bonusAmount), 0);
    const bonusPaid = earned
      .filter((b) => b.bonusPaidAt)
      .reduce((s, b) => s + num(b.bonusAmount), 0);

    return {
      from,
      to,
      ...report,
      totals: {
        ...report.totals,
        bonuses: bonusTotal,
        bonusesPaid: bonusPaid,
        companyNet: Math.round((report.totals.companyNet - bonusTotal) * 100) / 100,
      },
      byAgent: report.byAgent.map((a) => ({ ...a, fullName: name.get(a.userId)?.fullName ?? '—' })),
    };
  }

  /** Each agent's closed-deal commission and deal count per month: key "userId|YYYY-MM". */
  private async actuals(periods: string[], userIds?: string[]) {
    const out = new Map<string, { commission: number; deals: number }>();
    const uniq = [...new Set(periods)].sort();
    if (!uniq.length) return out;
    const rows = await this.prisma.deal.findMany({
      where: {
        status: DealStatus.CLOSED,
        agentId: userIds ? { in: userIds } : { not: null },
        closedOn: { gte: monthBounds(uniq[0]!).start, lt: monthBounds(uniq[uniq.length - 1]!).end },
      },
      select: { agentId: true, closedOn: true, commissionTotal: true },
    });
    for (const r of rows) {
      const k = `${r.agentId}|${monthKey(r.closedOn)}`;
      const a = out.get(k) ?? { commission: 0, deals: 0 };
      a.commission = Math.round((a.commission + num(r.commissionTotal)) * 100) / 100;
      a.deals += 1;
      out.set(k, a);
    }
    return out;
  }

  // ── Targets ──────────────────────────────────────────────────────────────

  /**
   * The month's targets with their progress. The admin sees every sales-side
   * member (with or without a target), a manager their team and themself, a
   * rep only themself.
   */
  async targets(user: AuthUser, periodArg?: string) {
    const period = periodArg ?? (await this.currentPeriod());
    this.assertPeriod(period);
    const scope = await clientOwnerScope(this.prisma, user);
    const staff = await scopedUserFindMany(
      this.prisma,
      {
        role: { in: SALES_SIDE },
        deletedAt: null,
        ...(scope === null ? { active: true } : { id: { in: scope } }),
      },
      { id: true, fullName: true, role: true, managerId: true },
    );
    const ids = staff.map((s) => s.id);
    const [targets, actual] = await Promise.all([
      this.prisma.brokerageTarget.findMany({ where: { period, userId: { in: ids } } }),
      this.actuals([period], ids),
    ]);
    const byUser = new Map(targets.map((t) => [t.userId, t]));
    const rows = staff
      .map((s) => {
        const t = byUser.get(s.id) ?? null;
        const a = actual.get(`${s.id}|${period}`) ?? { commission: 0, deals: 0 };
        const p = t
          ? targetProgress(
              { commissionTarget: num(t.commissionTarget), dealsTarget: t.dealsTarget },
              a,
            )
          : null;
        return {
          user: { id: s.id, fullName: s.fullName, role: s.role },
          target: t,
          actual: a,
          progress: p,
          bonus:
            !t || num(t.bonusAmount) === 0
              ? 'NONE'
              : t.bonusPaidAt
                ? 'PAID'
                : p?.achieved
                  ? 'EARNED'
                  : 'PENDING',
        };
      })
      .sort(
        (x, y) =>
          Number(!!y.target) - Number(!!x.target) ||
          (y.progress?.commissionPct ?? -1) - (x.progress?.commissionPct ?? -1) ||
          x.user.fullName.localeCompare(y.user.fullName),
      );

    const withTarget = rows.filter((r) => r.target);
    return {
      period,
      rows,
      totals: {
        commissionTarget: withTarget.reduce((s, r) => s + num(r.target!.commissionTarget), 0),
        commission: withTarget.reduce((s, r) => s + r.actual.commission, 0),
        achieved: withTarget.filter((r) => r.progress?.achieved).length,
        withTarget: withTarget.length,
      },
    };
  }

  async setTarget(period: string, userId: string, dto: SetTargetDto) {
    this.assertPeriod(period);
    const person = await findTenantUser(this.prisma, userId, { id: true, role: true });
    if (!person || !SALES_SIDE.includes(person.role))
      throw new BadRequestException('الموظف غير موجود');
    if (dto.commissionTarget <= 0 && dto.dealsTarget <= 0)
      throw new BadRequestException('حدّد عمولة مستهدفة أو عدد صفقات');
    const companyId = getRequiredCompanyId();
    const current = await this.prisma.brokerageTarget.findFirst({ where: { userId, period } });
    if (current?.bonusPaidAt)
      throw new ConflictException('صُرفت مكافأة هذا الهدف — تراجع عن الصرف أولاً');
    const data = {
      commissionTarget: dto.commissionTarget,
      dealsTarget: dto.dealsTarget,
      bonusAmount: dto.bonusAmount,
    };
    await this.prisma.brokerageTarget.upsert({
      where: { companyId_userId_period: { companyId, userId, period } },
      create: { ...data, userId, period, companyId },
      // A changed target may be met afresh: its notice can go again.
      update: { ...data, achievedNotifiedAt: null },
    });
    await this.checkAchieved(userId, period);
    return { ok: true };
  }

  async removeTarget(id: string) {
    const t = await this.prisma.brokerageTarget.findFirst({ where: { id } });
    if (!t) throw new NotFoundException('الهدف غير موجود');
    if (t.bonusPaidAt) throw new ConflictException('صُرفت مكافأة هذا الهدف — تراجع عن الصرف أولاً');
    await this.prisma.brokerageTarget.deleteMany({ where: { id } });
    return { ok: true };
  }

  /** Pay a target's bonus: only one that is met now, once. */
  async payBonus(id: string) {
    const t = await this.prisma.brokerageTarget.findFirst({ where: { id } });
    if (!t) throw new NotFoundException('الهدف غير موجود');
    if (num(t.bonusAmount) <= 0) throw new BadRequestException('لا مكافأة على هذا الهدف');
    const a = (await this.actuals([t.period], [t.userId])).get(`${t.userId}|${t.period}`) ?? {
      commission: 0,
      deals: 0,
    };
    if (
      !targetProgress({ commissionTarget: num(t.commissionTarget), dealsTarget: t.dealsTarget }, a)
        .achieved
    ) {
      throw new ConflictException('الهدف لم يتحقق بعد');
    }
    const done = await this.prisma.brokerageTarget.updateMany({
      where: { id, bonusPaidAt: null },
      data: { bonusPaidAt: new Date() },
    });
    if (done.count === 0) throw new ConflictException('صُرفت هذه المكافأة بالفعل');
    await this.notifications.sendToUsers([t.userId], 'brokerage_bonus_paid', {
      entityType: 'brokerage_target',
      entityId: t.id,
      period: t.period,
      amount: num(t.bonusAmount),
    });
    return { ok: true };
  }

  async unpayBonus(id: string) {
    const done = await this.prisma.brokerageTarget.updateMany({
      where: { id, bonusPaidAt: { not: null } },
      data: { bonusPaidAt: null },
    });
    if (done.count === 0) throw new NotFoundException('المكافأة غير مصروفة');
    return { ok: true };
  }

  /**
   * After a deal or a target change: when the agent's month is now met and
   * they have not been told, tell them (and their manager) once.
   */
  async checkAchieved(userId: string | null, period: string) {
    if (!userId) return;
    const t = await this.prisma.brokerageTarget.findFirst({
      where: { userId, period, achievedNotifiedAt: null },
    });
    if (!t) return;
    const a = (await this.actuals([period], [userId])).get(`${userId}|${period}`) ?? {
      commission: 0,
      deals: 0,
    };
    if (
      !targetProgress({ commissionTarget: num(t.commissionTarget), dealsTarget: t.dealsTarget }, a)
        .achieved
    )
      return;
    const marked = await this.prisma.brokerageTarget.updateMany({
      where: { id: t.id, achievedNotifiedAt: null },
      data: { achievedNotifiedAt: new Date() },
    });
    if (marked.count === 0) return;
    const person = await findTenantUser(this.prisma, userId, { managerId: true, fullName: true });
    await this.notifications.sendToUsers([userId, person?.managerId], 'brokerage_target_achieved', {
      entityType: 'brokerage_target',
      entityId: t.id,
      period,
      agentName: person?.fullName ?? '',
      amount: num(t.bonusAmount),
    });
  }
}
