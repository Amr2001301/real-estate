import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { runInCompany, runTenantContext } from '../../common/tenant/tenant-context';
import { reportFailure } from '../../common/observability/report-failure';
import { MAX_DELIVERY_RETRIES, NotificationsService } from './notifications.module';

/**
 * On in production unless NOTIFICATION_RETRY_ENABLED=false; elsewhere (dev,
 * tests) only when set to true, so a cron never fires mid-test.
 */
function isEnabled(config: ConfigService): boolean {
  const flag = (config.get<string>('NOTIFICATION_RETRY_ENABLED') ?? '').toLowerCase();
  if (flag) return flag === 'true';
  return config.get<string>('NODE_ENV') === 'production';
}

/**
 * FG-09 — every 10 minutes, re-send the push / e-mail of notifications whose
 * delivery failed in the last 24 hours (see
 * NotificationsService.retryFailedDeliveries). The in-app row was never lost;
 * this only retries the outside channels.
 */
@Injectable()
export class NotificationRetryCron {
  private readonly logger = new Logger(NotificationRetryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  @Cron('*/10 * * * *', { name: 'notification-delivery-retry' })
  async tick(): Promise<void> {
    if (!isEnabled(this.config)) return;
    const run = () => this.retryAll();
    try {
      if (this.lock) {
        await this.lock.withLock('notification-delivery-retry', 5 * 60_000, run);
      } else {
        await run();
      }
    } catch (err) {
      reportFailure(this.logger, 'cron', '[notification-retry] failed', err, 'error');
    }
  }

  /** Retries company by company: delivery reads tenant-scoped data. */
  async retryAll(now = new Date()): Promise<number> {
    // Awaited inside the context: a Prisma query only runs when awaited.
    const companies = await runTenantContext(
      { companyId: null, bypass: true, isPublic: false },
      async () =>
        await this.prisma.notification.groupBy({
          by: ['companyId'],
          where: {
            companyId: { not: null },
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
            deliveryRetries: { lt: MAX_DELIVERY_RETRIES },
            OR: [{ pushError: { not: null } }, { emailError: { not: null } }],
          },
        }),
    );
    let total = 0;
    for (const { companyId } of companies) {
      if (!companyId) continue;
      try {
        total += await runInCompany(companyId, () =>
          this.notifications.retryFailedDeliveries(now),
        );
      } catch (err) {
        reportFailure(this.logger, 'cron', `[notification-retry] company ${companyId} failed`, err);
      }
    }
    if (total > 0) this.logger.log(`[notification-retry] retried ${total} notification(s)`);
    return total;
  }
}
