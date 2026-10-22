import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { captureExceptionSafe } from '../../common/observability/sentry';
import { runTenantContext } from '../../common/tenant/tenant-context';
import { CompanyDomainsService } from './company-domains.service';

/**
 * Every 10 minutes: a custom domain added lately is checked again — its
 * ownership record and its state on the website's hosting — so it goes live
 * by itself once the company's DNS has spread.
 */
@Injectable()
export class DomainCheckCron {
  private readonly logger = new Logger(DomainCheckCron.name);

  constructor(
    private readonly domains: CompanyDomainsService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run() {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      try {
        const result = this.lock
          ? await this.lock.withLock('domain-check', 9 * 60_000, () => this.domains.checkPending())
          : await this.domains.checkPending();
        if (result && result.checked > 0) {
          this.logger.log(`Domain check: checked=${result.checked} verified=${result.verified} ready=${result.ready}`);
        }
      } catch (err) {
        this.logger.error(`[domain-check] cron failed: ${(err as Error).message}`);
        captureExceptionSafe(err, { job: 'domain-check' });
      }
    });
  }
}
