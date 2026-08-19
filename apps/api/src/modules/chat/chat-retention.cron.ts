import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { runTenantContext } from '../../common/tenant/tenant-context';

const RETENTION_DAYS = 90;
const TZ = process.env.CHAT_RETENTION_TIMEZONE || undefined;

function isEnabled(config: ConfigService): boolean {
  return (config.get<string>('CHAT_RETENTION_ENABLED') ?? '').toLowerCase() === 'true';
}

/**
 * Daily cron that hard-deletes anonymous chat sessions (and their cascaded
 * messages + feedback) whose last message is older than RETENTION_DAYS days.
 * Gated by CHAT_RETENTION_ENABLED=true. Safe to run multi-instance — the
 * optional CronLockService prevents concurrent runs via a Redis SET NX lock.
 */
@Injectable()
export class ChatRetentionCron {
  private readonly logger = new Logger(ChatRetentionCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  /** Fires at 03:00 every night. Lock TTL is 10 min — well under 24 h. */
  @Cron('0 3 * * *', { name: 'chat-retention-purge', timeZone: TZ })
  async purgeExpiredSessions(): Promise<void> {
    if (!isEnabled(this.config)) return;
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      const run = () => this.purge();
      try {
        if (this.lock) {
          await this.lock.withLock('chat-retention', 10 * 60_000, run);
        } else {
          await run();
        }
      } catch (err) {
        this.logger.error(`[chat-retention] failed: ${(err as Error).message}`);
      }
    });
  }

  private async purge(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const { count } = await this.prisma.chatSession.deleteMany({
      where: { lastMessageAt: { lt: cutoff } },
    });

    if (count > 0) {
      this.logger.log(
        `[chat-retention] Purged ${count} session(s) older than ${RETENTION_DAYS} days`,
      );
    }
  }
}
