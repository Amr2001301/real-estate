import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { runTenantContext } from '../../common/tenant/tenant-context';
import { reportFailure } from '../../common/observability/report-failure';
import { AiPlansService } from './ai-plans.service';

/** Every hour: assistant periods ending soon are announced; ended ones stop. */
@Injectable()
export class AiPlansCron {
  private readonly logger = new Logger(AiPlansCron.name);

  constructor(
    private readonly plans: AiPlansService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run() {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      try {
        const result = this.lock
          ? await this.lock.withLock('ai-plans', 50 * 60_000, () => this.plans.sweep())
          : await this.plans.sweep();
        if (result && (result.endingSoon || result.ended)) {
          this.logger.log(`[ai-plans] endingSoon=${result.endingSoon} ended=${result.ended}`);
        }
      } catch (err) {
        reportFailure(this.logger, 'cron', '[ai-plans] cron failed', err, 'error');
      }
    });
  }
}
