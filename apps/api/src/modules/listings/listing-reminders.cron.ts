import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { CompanyType, TenancyStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { runInCompany, runTenantContext } from '../../common/tenant/tenant-context';
import { scopedUserFindMany } from '../../common/tenant/resolve-tenant-entity';
import { reportFailure } from '../../common/observability/report-failure';
import { companyTimeZones, startOfLocalToday } from '../../common/time/company-timezone';
import { NotificationsService } from '../notifications/notifications.module';
import { localHour } from '../leads/follow-up-reminder.cron';
import { MANDATE_EXPIRY_NOTICE_DAYS, TENANCY_ENDING_NOTICE_DAYS, daysUntil, rentSchedule } from './brokerage-terms';

/**
 * On in production unless LISTING_REMINDERS_ENABLED=false; elsewhere (dev,
 * tests) only when set to true, so a cron never fires mid-test.
 */
function isEnabled(config: ConfigService): boolean {
  const flag = (config.get<string>('LISTING_REMINDERS_ENABLED') ?? '').toLowerCase();
  if (flag) return flag === 'true';
  return config.get<string>('NODE_ENV') === 'production';
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * BRK-2 — a brokerage's morning reminders (the company's 09:00), each sent
 * once to the listing's agent (the company admins when it has none):
 * - a mandate ending within 14 days (`expiryNotifiedAt`);
 * - a tenancy ending within 30 days (`endingNotifiedAt`);
 * - a month's rent due today or past its day and still unpaid
 *   (`lastDueReminderPeriod`: once per month).
 * Each row is marked before the notice goes, so a double run sends once.
 */
@Injectable()
export class ListingRemindersCron {
  private readonly logger = new Logger(ListingRemindersCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  @Cron('5 * * * *', { name: 'listing-reminders' })
  async hourly(): Promise<void> {
    if (!isEnabled(this.config)) return;
    const hour = Number(this.config.get<string>('LISTING_REMINDER_HOUR') ?? 9);
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      try {
        const run = () => this.run(new Date(), Number.isInteger(hour) ? hour : 9);
        if (this.lock) await this.lock.withLock('listing-reminders', 30 * 60_000, run);
        else await run();
      } catch (err) {
        reportFailure(this.logger, 'cron', '[listing-reminders] failed', err, 'error');
      }
    });
  }

  /** Every brokerage whose local hour is `hour` (all of them when null). */
  async run(now: Date, hour: number | null): Promise<number> {
    const companies = await this.prisma.company.findMany({ where: { type: CompanyType.BROKERAGE }, select: { id: true } });
    const zones = await companyTimeZones(this.prisma, companies.map((c) => c.id));
    let sent = 0;
    for (const { id } of companies) {
      const zone = zones.get(id)!;
      if (hour !== null && localHour(zone, now) !== hour) continue;
      sent += await runInCompany(id, () => this.forCompany(id, startOfLocalToday(zone, now)));
    }
    if (sent) this.logger.log(`Listing reminders: ${sent} sent`);
    return sent;
  }

  /** The listing's agent, or the company's admins when it has none. */
  private async recipients(agentId: string | null): Promise<string[]> {
    if (agentId) return [agentId];
    const admins = await scopedUserFindMany(this.prisma, { role: UserRole.ADMIN, active: true, deletedAt: null }, { id: true });
    return admins.map((a) => a.id);
  }

  private async forCompany(companyId: string, today: Date): Promise<number> {
    let sent = 0;
    const listing = { select: { id: true, code: true, title: true, agentId: true } } as const;

    const mandates = await this.prisma.listingMandate.findMany({
      where: {
        companyId,
        cancelledAt: null,
        expiryNotifiedAt: null,
        startDate: { lte: today },
        endDate: { gte: today, lte: new Date(today.getTime() + MANDATE_EXPIRY_NOTICE_DAYS * 86_400_000) },
      },
      include: { listing },
    });
    for (const m of mandates) {
      const marked = await this.prisma.listingMandate.updateMany({ where: { id: m.id, expiryNotifiedAt: null }, data: { expiryNotifiedAt: new Date() } });
      if (marked.count === 0) continue;
      await this.notifications.sendToUsers(await this.recipients(m.listing.agentId), 'listing_mandate_expiring', {
        entityType: 'listing',
        entityId: m.listingId,
        listingCode: m.listing.code,
        title: m.listing.title,
        days: daysUntil(m.endDate, today),
        endDate: ymd(m.endDate),
      });
      sent += 1;
    }

    const tenancies = await this.prisma.tenancy.findMany({
      where: { companyId, status: TenancyStatus.ACTIVE },
      include: { listing, payments: true },
    });
    for (const t of tenancies) {
      const to = await this.recipients(t.listing.agentId);
      const base = { entityType: 'listing', entityId: t.listingId, listingCode: t.listing.code, title: t.listing.title, tenantName: t.tenantName };
      const daysLeft = daysUntil(t.endDate, today);
      if (!t.endingNotifiedAt && daysLeft >= 0 && daysLeft <= TENANCY_ENDING_NOTICE_DAYS) {
        const marked = await this.prisma.tenancy.updateMany({ where: { id: t.id, endingNotifiedAt: null }, data: { endingNotifiedAt: new Date() } });
        if (marked.count) {
          await this.notifications.sendToUsers(to, 'tenancy_ending', { ...base, days: daysLeft, endDate: ymd(t.endDate) });
          sent += 1;
        }
      }
      // The latest month due by today and unpaid — one reminder per month.
      const due = rentSchedule(
        { startDate: t.startDate, endDate: t.endDate, paymentDay: t.paymentDay, monthlyRent: Number(t.monthlyRent) },
        t.payments.map((p) => ({ period: p.period, amount: Number(p.amount), paidOn: p.paidOn })),
        today,
      ).filter((r) => r.state === 'OVERDUE' || r.state === 'DUE_TODAY');
      const latest = due[due.length - 1];
      if (latest && t.lastDueReminderPeriod !== latest.period) {
        const marked = await this.prisma.tenancy.updateMany({
          where: { id: t.id, OR: [{ lastDueReminderPeriod: null }, { lastDueReminderPeriod: { not: latest.period } }] },
          data: { lastDueReminderPeriod: latest.period },
        });
        if (marked.count) {
          await this.notifications.sendToUsers(to, 'rent_due', { ...base, amount: latest.amount, dueDate: latest.dueDate, unpaidMonths: due.length });
          sent += 1;
        }
      }
    }
    return sent;
  }
}
