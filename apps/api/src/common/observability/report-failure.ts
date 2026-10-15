/**
 * Reporting for failures the caller deliberately swallows.
 *
 * A side effect (notification, document back-link, cron item, e-mail) must not
 * fail the business action that triggered it, so its errors are caught. Before
 * this helper they were only a log line — invisible unless someone read the
 * logs. Every swallowed failure now also:
 *   * goes to Sentry, tagged with its `area` (no-op when SENTRY_DSN is unset);
 *   * increments `swallowed_errors_total{area}` on /metrics, so a rate can be
 *     alerted on even without Sentry.
 *
 * `area` must be a fixed string (e.g. 'notification', 'deposit-receipt-link'),
 * never an id — it is a metric label.
 */

import type { Logger } from '@nestjs/common';
import { Counter, register } from 'prom-client';
import { captureExceptionSafe } from './sentry';

export const swallowedErrorsTotal = new Counter({
  name: 'swallowed_errors_total',
  help: 'Errors caught so the triggering action could succeed, by area',
  labelNames: ['area'],
  registers: [register],
});

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function reportFailure(
  logger: Pick<Logger, 'warn' | 'error'>,
  area: string,
  message: string,
  err: unknown,
  level: 'warn' | 'error' = 'warn',
): void {
  const reason = err instanceof Error ? err.message : String(err);
  logger[level](`${message}: ${reason}`);
  swallowedErrorsTotal.inc({ area });
  captureExceptionSafe(forSentry(err, reason), { area });
}

/** SMTP and provider errors often quote the recipient — keep addresses out of Sentry. */
function forSentry(err: unknown, reason: string): Error {
  const out = new Error(reason.replace(EMAIL_RE, '<email>'));
  if (err instanceof Error) {
    out.name = err.name;
    out.stack = err.stack?.replace(EMAIL_RE, '<email>');
  }
  return out;
}
