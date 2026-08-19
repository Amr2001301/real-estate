import { Injectable, Logger, Module, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentsModule } from '../documents/documents.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { captureExceptionSafe } from '../../common/observability/sentry';
import { runTenantContext } from '../../common/tenant/tenant-context';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

export { MaintenanceService } from './maintenance.service';

/**
 * Hourly sweep that flags complaints older than the unresolved window. Mirrors
 * the always-on InstallmentsCron pattern; `markUnresolved()` is idempotent so
 * re-runs are safe. ScheduleModule is registered globally in AppModule.
 */
@Injectable()
export class MaintenanceUnresolvedCron {
  private readonly logger = new Logger(MaintenanceUnresolvedCron.name);

  constructor(
    private readonly svc: MaintenanceService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run() {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      try {
        if (this.lock) {
          await this.lock.withLock('maintenance-unresolved', 2 * 60_000, () => this.svc.markUnresolved());
        } else {
          await this.svc.markUnresolved();
        }
      } catch (err) {
        this.logger.error(`[maintenance-unresolved] cron failed: ${(err as Error).message}`);
        captureExceptionSafe(err, { job: 'maintenance-unresolved' });
      }
    });
  }
}

/**
 * Hourly SLA check: fires `maintenance_sla_warning` when a request's dueAt is
 * ≤2 h away, and `maintenance_sla_breached` once it has passed. Each fires only
 * once per request (deduped via the Notification table — no schema migration
 * needed). ScheduleModule is registered globally in AppModule.
 */
@Injectable()
export class MaintenanceSlaCheckCron {
  private readonly logger = new Logger(MaintenanceSlaCheckCron.name);

  constructor(
    private readonly svc: MaintenanceService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run() {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      try {
        if (this.lock) {
          await this.lock.withLock('maintenance-sla-check', 2 * 60_000, () => this.svc.checkSla());
        } else {
          await this.svc.checkSla();
        }
      } catch (err) {
        this.logger.error(`[maintenance-sla-check] cron failed: ${(err as Error).message}`);
        captureExceptionSafe(err, { job: 'maintenance-sla-check' });
      }
    });
  }
}

@Module({
  imports: [DocumentsModule, MediaModule, NotificationsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceUnresolvedCron, MaintenanceSlaCheckCron],
})
export class MaintenanceModule {}
