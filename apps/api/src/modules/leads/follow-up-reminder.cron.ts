import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { LeadFollowUpType, LeadStage, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.module';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { runInCompany, runTenantContext } from '../../common/tenant/tenant-context';
import { reportFailure } from '../../common/observability/report-failure';
import { companyTimeZones, endOfLocalTodayInstant } from '../../common/time/company-timezone';
import { followUpStaff } from '../../common/utils/sales-scope';

const OPEN_STAGES: LeadStage[] = [LeadStage.NEW, LeadStage.INTERESTED, LeadStage.VISIT, LeadStage.NEGOTIATION];
/** A reminder goes this long before the follow-up. */
export const REMIND_BEFORE_MS = 15 * 60_000;
/** An overdue alert goes this long after it, when nothing was logged. */
export const OVERDUE_AFTER_MS = 30 * 60_000;
/** Older follow-ups are never alerted (the morning list carries them). */
const OVERDUE_LOOKBACK_MS = 24 * 60 * 60_000;

export const ACTION_TEXT: Record<LeadFollowUpType, { ar: string; en: string }> = {
  CALL: { ar: 'مكالمة', en: 'Call' },
  MEETING: { ar: 'اجتماع', en: 'Meeting' },
  WHATSAPP: { ar: 'رسالة واتساب', en: 'WhatsApp message' },
  FOLLOW_UP: { ar: 'متابعة', en: 'Follow-up' },
};

/** The local hour of day (0–23) in a time zone. */
export function localHour(timeZone: string, at: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at));
}

/** "14:30" in a time zone. */
export function localTime(timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
}

/**
 * On in production unless FOLLOW_UP_REMINDERS_ENABLED=false; elsewhere
 * (dev, tests) only when set to true, so a cron never fires mid-test.
 */
function isEnabled(config: ConfigService): boolean {
  const flag = (config.get<string>('FOLLOW_UP_REMINDERS_ENABLED') ?? '').toLowerCase();
  if (flag) return flag === 'true';
  return config.get<string>('NODE_ENV') === 'production';
}

interface DueLead {
  id: string;
  companyId: string;
  fullName: string;
  nextActionAt: Date;
  nextActionType: LeadFollowUpType | null;
  assignedSalesId: string;
}

/**
 * FU2 — follow-ups that reach the rep without opening the dashboard:
 * - 15 minutes before a lead's next action, its rep is reminded;
 * - 30 minutes after it, if nothing changed it (a logged call moves or
 *   clears the next action), the rep is told it is overdue;
 * - each morning (the company's 09:00), every rep gets today's count and
 *   the overdue ones, and every sales manager their team's.
 * Each reminder and alert is sent once per follow-up time
 * (`followUpRemindedFor` / `followUpOverdueFor`); a new time is new.
 */
@Injectable()
export class FollowUpReminderCron {
  private readonly logger = new Logger(FollowUpReminderCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  @Cron('*/5 * * * *', { name: 'follow-up-reminders' })
  async every5Minutes(): Promise<void> {
    if (!isEnabled(this.config)) return;
    await this.locked('follow-up-reminders', 4 * 60_000, () => this.sendReminders());
  }

  @Cron('0 * * * *', { name: 'follow-up-daily' })
  async hourly(): Promise<void> {
    if (!isEnabled(this.config)) return;
    const hour = Number(this.config.get<string>('FOLLOW_UP_DIGEST_HOUR') ?? 9);
    await this.locked('follow-up-daily', 30 * 60_000, () => this.sendDailyLists(new Date(), Number.isInteger(hour) ? hour : 9));
  }

  private async locked(name: string, ttl: number, run: () => Promise<unknown>) {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      try {
        if (this.lock) await this.lock.withLock(name, ttl, run);
        else await run();
      } catch (err) {
        reportFailure(this.logger, 'cron', `[${name}] failed`, err, 'error');
      }
    });
  }

  /** The reminders before and the alerts after (runs in bypass, across companies). */
  async sendReminders(now = new Date()): Promise<{ reminded: number; overdue: number }> {
    const open = Prisma.join(OPEN_STAGES.map((s) => Prisma.sql`${s}::"LeadStage"`));
    const pick = (column: 'followUpRemindedFor' | 'followUpOverdueFor', from: Date, to: Date) =>
      this.prisma.$queryRaw<DueLead[]>(Prisma.sql`
        SELECT l.id, l."companyId", l."fullName", l."nextActionAt", l."nextActionType", l."assignedSalesId"
        FROM "Lead" l
        JOIN "User" u ON u.id = l."assignedSalesId" AND u."companyId" = l."companyId"
        WHERE l."companyId" IS NOT NULL
          AND l."nextActionAt" > ${from} AND l."nextActionAt" <= ${to}
          AND l.stage IN (${open})
          AND (l.${Prisma.raw(`"${column}"`)} IS NULL OR l.${Prisma.raw(`"${column}"`)} <> l."nextActionAt")
          AND u.active AND u."deletedAt" IS NULL
        ORDER BY l."nextActionAt"
        LIMIT 500
      `);
    const [soon, late] = await Promise.all([
      pick('followUpRemindedFor', now, new Date(now.getTime() + REMIND_BEFORE_MS)),
      pick('followUpOverdueFor', new Date(now.getTime() - OVERDUE_LOOKBACK_MS), new Date(now.getTime() - OVERDUE_AFTER_MS)),
    ]);
    const zones = await companyTimeZones(this.prisma, [...new Set([...soon, ...late].map((l) => l.companyId))]);
    const send = async (l: DueLead, code: string, column: 'followUpRemindedFor' | 'followUpOverdueFor') => {
      const action = ACTION_TEXT[l.nextActionType ?? LeadFollowUpType.FOLLOW_UP];
      await runInCompany(l.companyId, async () => {
        // Marked first, and only while the time is unchanged: a follow-up
        // moved meanwhile is the next run's, and a double run sends once.
        const marked = await this.prisma.lead.updateMany({
          where: { id: l.id, companyId: l.companyId, nextActionAt: l.nextActionAt },
          data: { [column]: l.nextActionAt },
        });
        if (marked.count === 0) return;
        await this.notifications.sendToUsers([l.assignedSalesId], code, {
          entityType: 'lead',
          entityId: l.id,
          customerName: l.fullName,
          actionAr: action.ar,
          actionEn: action.en,
          time: localTime(zones.get(l.companyId)!, l.nextActionAt),
        });
      });
    };
    for (const l of soon) await send(l, 'follow_up_due_soon', 'followUpRemindedFor');
    for (const l of late) await send(l, 'follow_up_overdue', 'followUpOverdueFor');
    if (soon.length || late.length) this.logger.log(`Follow-up reminders: ${soon.length} soon, ${late.length} overdue`);
    return { reminded: soon.length, overdue: late.length };
  }

  /**
   * The morning list, for each company whose local hour is `hour` (all of
   * them when `hour` is null): to each rep with follow-ups due today or
   * overdue, and to each sales manager for their team and themselves.
   */
  async sendDailyLists(now: Date, hour: number | null): Promise<number> {
    const companies = await this.prisma.company.findMany({ select: { id: true } });
    const zones = await companyTimeZones(this.prisma, companies.map((c) => c.id));
    let sent = 0;
    for (const { id: companyId } of companies) {
      const zone = zones.get(companyId)!;
      if (hour !== null && localHour(zone, now) !== hour) continue;
      sent += await runInCompany(companyId, () => this.dailyListsFor(companyId, now, endOfLocalTodayInstant(zone, now)));
    }
    return sent;
  }

  private async dailyListsFor(companyId: string, now: Date, endOfToday: Date): Promise<number> {
    const count = (at: Prisma.DateTimeNullableFilter) =>
      this.prisma.lead.groupBy({
        by: ['assignedSalesId'],
        where: { companyId, stage: { in: OPEN_STAGES }, assignedSalesId: { not: null }, nextActionAt: at },
        _count: true,
      });
    const [overdueRows, todayRows] = await Promise.all([count({ lt: now }), count({ gte: now, lt: endOfToday })]);
    if (!overdueRows.length && !todayRows.length) return 0;
    const overdue = new Map(overdueRows.map((r) => [r.assignedSalesId!, r._count]));
    const today = new Map(todayRows.map((r) => [r.assignedSalesId!, r._count]));
    const staff = await followUpStaff(this.prisma);
    let sent = 0;

    for (const u of staff) {
      const o = overdue.get(u.id) ?? 0;
      const t = today.get(u.id) ?? 0;
      if (o + t > 0) {
        await this.notifications.sendToUsers([u.id], 'follow_up_daily', { entityType: 'follow_ups', today: t, overdue: o });
        sent += 1;
      }
    }
    for (const m of staff.filter((u) => u.role === UserRole.SALES_MANAGER)) {
      const team = [m.id, ...staff.filter((u) => u.role === UserRole.SALES && u.managerId === m.id).map((u) => u.id)];
      const o = team.reduce((n, id) => n + (overdue.get(id) ?? 0), 0);
      const t = team.reduce((n, id) => n + (today.get(id) ?? 0), 0);
      if (team.length < 2 || o + t === 0) continue;
      const lateReps = team.filter((id) => (overdue.get(id) ?? 0) > 0).length;
      await this.notifications.sendToUsers([m.id], 'follow_up_team_daily', { entityType: 'follow_ups', today: t, overdue: o, lateReps });
      sent += 1;
    }
    return sent;
  }
}
