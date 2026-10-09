import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.module';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { runInCompany, runTenantContext } from '../../common/tenant/tenant-context';

const TZ = process.env.APPOINTMENT_REMINDER_TIMEZONE || undefined;

/**
 * On in production unless APPOINTMENT_REMINDERS_ENABLED=false; elsewhere
 * (dev, tests) only when set to true, so a cron never fires mid-test.
 */
function isEnabled(config: ConfigService): boolean {
  const flag = (config.get<string>('APPOINTMENT_REMINDERS_ENABLED') ?? '').toLowerCase();
  if (flag) return flag === 'true';
  return config.get<string>('NODE_ENV') === 'production';
}

@Injectable()
export class AppointmentReminderCron {
  private readonly logger = new Logger(AppointmentReminderCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  /** Day-before reminder — fires at 09:00 every morning. */
  @Cron('0 9 * * *', { name: 'appointment-day-before-reminder', timeZone: TZ })
  async dayBeforeReminder(): Promise<void> {
    if (!isEnabled(this.config)) return;
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      const run = () => this.sendDayBeforeReminders();
      try {
        if (this.lock) {
          await this.lock.withLock('appointment-day-before', 5 * 60_000, run);
        } else {
          await run();
        }
      } catch (err) {
        this.logger.error(`[appointment-day-before] failed: ${(err as Error).message}`);
      }
    });
  }

  /** Hour-before reminder — runs every 15 minutes. */
  @Cron('*/15 * * * *', { name: 'appointment-hour-before-reminder', timeZone: TZ })
  async hourBeforeReminder(): Promise<void> {
    if (!isEnabled(this.config)) return;
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      const run = () => this.sendHourBeforeReminders();
      try {
        if (this.lock) {
          await this.lock.withLock('appointment-hour-before', 2 * 60_000, run);
        } else {
          await run();
        }
      } catch (err) {
        this.logger.error(`[appointment-hour-before] failed: ${(err as Error).message}`);
      }
    });
  }

  private async sendDayBeforeReminders(): Promise<void> {
    const now = new Date();
    const startOfTomorrow = new Date(now);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    startOfTomorrow.setHours(0, 0, 0, 0);

    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

    const appointments = await this.prisma.visitAppointment.findMany({
      where: {
        // A confirmed visit needs its reminder as much as a scheduled one.
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        scheduledAt: { gte: startOfTomorrow, lt: endOfTomorrow },
        dayBeforeReminderSentAt: null,
      },
      select: {
        id: true,
        companyId: true,
        visitNumber: true,
        scheduledAt: true,
        clientId: true,
        assignedSalesId: true,
        project: { select: { name: true } },
      },
    });

    if (appointments.length === 0) return;
    this.logger.log(`[day-before] Sending ${appointments.length} reminders`);

    for (const appt of appointments) {
      if (!appt.companyId) {
        this.logger.warn(`[day-before] appointment ${appt.id} has no company — reminder skipped`);
        continue;
      }
      const projectName = this.extractAr(appt.project?.name);
      const payload = {
        visitNumber: appt.visitNumber,
        scheduledAt: appt.scheduledAt.toISOString(),
        projectName,
      };

      // The sweep runs in bypass; each reminder is sent in the appointment's
      // own company so the recipients resolve and the rows carry companyId.
      await runInCompany(appt.companyId, async () => {
        await this.notifications.sendToUsers(
          [appt.clientId, appt.assignedSalesId],
          'appointment_day_before_reminder',
          payload,
        );

        await this.prisma.visitAppointment.update({
          where: { id: appt.id },
          data: { dayBeforeReminderSentAt: new Date() },
        });
      });
    }
  }

  private async sendHourBeforeReminders(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 45 * 60_000);
    const windowEnd   = new Date(now.getTime() + 75 * 60_000);

    const appointments = await this.prisma.visitAppointment.findMany({
      where: {
        // A confirmed visit needs its reminder as much as a scheduled one.
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        scheduledAt: { gte: windowStart, lte: windowEnd },
        hourBeforeReminderSentAt: null,
      },
      select: {
        id: true,
        companyId: true,
        visitNumber: true,
        scheduledAt: true,
        clientId: true,
        assignedSalesId: true,
        project: { select: { name: true } },
      },
    });

    if (appointments.length === 0) return;
    this.logger.log(`[hour-before] Sending ${appointments.length} reminders`);

    for (const appt of appointments) {
      if (!appt.companyId) {
        this.logger.warn(`[hour-before] appointment ${appt.id} has no company — reminder skipped`);
        continue;
      }
      const projectName = this.extractAr(appt.project?.name);
      const payload = {
        visitNumber: appt.visitNumber,
        scheduledAt: appt.scheduledAt.toISOString(),
        projectName,
      };

      // The sweep runs in bypass; each reminder is sent in the appointment's
      // own company so the recipients resolve and the rows carry companyId.
      await runInCompany(appt.companyId, async () => {
        await this.notifications.sendToUsers(
          [appt.clientId, appt.assignedSalesId],
          'appointment_hour_before_reminder',
          payload,
        );

        await this.prisma.visitAppointment.update({
          where: { id: appt.id },
          data: { hourBeforeReminderSentAt: new Date() },
        });
      });
    }
  }

  private extractAr(name: unknown): string {
    if (!name || typeof name !== 'object') return '';
    const n = name as Record<string, unknown>;
    return (typeof n.ar === 'string' ? n.ar : typeof n.en === 'string' ? n.en : '') || '';
  }
}
