import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

const ERROR_LOG_INTERVAL_MS = 60_000;

/**
 * The Redis client for a request-path cache (capabilities, domain resolution,
 * branding). Every caller treats Redis as an optimisation: a failed read or
 * write is caught and the value comes from the database instead.
 *
 * docs/audit/06-ci-gaps.md G16 — with the previous options a command issued
 * while Redis was unreachable was queued until ioredis gave up reconnecting,
 * so during an outage every request that touched a cache waited on retries
 * before falling back (the CI security suite went from ~1 min to ~30). Here:
 *
 *   - `enableOfflineQueue: false` — a command sent while disconnected is
 *     rejected at once, so the caller's database fallback runs immediately.
 *   - `lazyConnect` — the connection opens on first use (no sockets in tests
 *     or processes that never touch the cache). That first command is
 *     rejected while connecting and served from the database; the rest go to
 *     Redis once it is up.
 *   - an `error` listener, rate-limited: without one ioredis prints
 *     "Unhandled error event" on every reconnect attempt.
 *
 * Not for the cron lock (CronLockModule): a lock command must wait for the
 * connection, or the first run after a deploy would be skipped.
 */
export function createCacheRedis(url: string, name: string): Redis {
  const logger = new Logger(`Redis:${name}`);
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  let lastLogged = 0;
  client.on('error', (err: Error) => {
    const now = Date.now();
    if (now - lastLogged < ERROR_LOG_INTERVAL_MS) return;
    lastLogged = now;
    logger.warn(`${err.message} — serving from the database until Redis is back`);
  });
  return client;
}
