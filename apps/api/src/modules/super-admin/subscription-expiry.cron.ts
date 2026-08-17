import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SuperAdminService } from './super-admin.service';

@Injectable()
export class SubscriptionExpiryCron {
  private readonly logger = new Logger(SubscriptionExpiryCron.name);

  constructor(private readonly service: SuperAdminService) {}

  /** Runs once per day at 01:00 UTC. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleExpiry() {
    try {
      const result = await this.service.runExpiryCheck();
      if (result.expired > 0 || result.cancelled > 0) {
        this.logger.log(
          `[subscription-expiry] expired=${result.expired} cancelled=${result.cancelled}`,
        );
      }
    } catch (err) {
      this.logger.error(`[subscription-expiry] cron failed: ${(err as Error).message}`);
    }
  }
}
