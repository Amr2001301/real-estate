import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';

export const CRON_LOCK_REDIS = Symbol('CRON_LOCK_REDIS');

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

@Injectable()
export class CronLockService implements OnModuleDestroy {
  private readonly logger = new Logger(CronLockService.name);

  constructor(@Inject(CRON_LOCK_REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => {});
  }

  /** PING the Redis connection — used by the readiness health check. */
  async ping(): Promise<boolean> {
    try {
      const result = await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timeout')), 2_000),
        ),
      ]);
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Acquire a distributed Redis lock for `key`, run `fn`, then release.
   * Returns null without calling `fn` when the lock is already held by another
   * instance or when Redis is unavailable (fail-closed). `ttlMs` should be set
   * slightly below the cron schedule interval so a crashed job never blocks
   * the next scheduled run indefinitely.
   */
  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
    const owner = randomUUID();
    const lockKey = `cron-lock:${key}`;

    let acquired: string | null;
    try {
      acquired = await this.redis.set(lockKey, owner, 'PX', ttlMs, 'NX');
    } catch (err) {
      this.logger.error(
        `[cron-lock] Redis unavailable for key "${key}": ${(err as Error).message} — skipping job`,
      );
      return null;
    }

    if (!acquired) {
      this.logger.debug(`[cron-lock] Skipped "${key}" — lock held by another instance`);
      return null;
    }

    this.logger.debug(`[cron-lock] Acquired "${key}"`);
    try {
      return await fn();
    } finally {
      try {
        await this.redis.eval(RELEASE_SCRIPT, 1, lockKey, owner);
      } catch (err) {
        this.logger.warn(
          `[cron-lock] Release failed for "${key}": ${(err as Error).message} — TTL will expire`,
        );
      }
    }
  }
}
