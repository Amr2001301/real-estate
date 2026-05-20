/**
 * Optional Sentry wiring for the API.
 *
 * Design notes:
 *   * `@sentry/node` is loaded with `require()` only when `SENTRY_DSN` is set,
 *     so an env with no Sentry config pays neither the init cost nor the
 *     resident memory of the SDK.
 *   * Every public helper (`captureExceptionSafe`, `setUserContextSafe`) is
 *     safe to call when Sentry isn't initialised — they no-op silently.
 *   * `beforeSend` strips request bodies, query strings, headers, and cookies
 *     so we never ship PII or auth material to the Sentry backend.
 */

import { Logger } from '@nestjs/common';

type SentryModule = typeof import('@sentry/node');
let sentry: SentryModule | null = null;
let initialised = false;
const log = new Logger('Sentry');

function shouldRedactRequestField(name: string): boolean {
  const lc = name.toLowerCase();
  return (
    lc.includes('authorization') ||
    lc.includes('cookie') ||
    lc.includes('token') ||
    lc.includes('password') ||
    lc.includes('secret') ||
    lc.includes('otp')
  );
}

export function initSentry(): void {
  if (initialised) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require('@sentry/node') as SentryModule;
    sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
      // Strip identifying request data before transmit.
      beforeSend(event) {
        if (event.request) {
          event.request.data = undefined;
          event.request.query_string = undefined;
          event.request.cookies = undefined;
          if (event.request.headers && typeof event.request.headers === 'object') {
            const headers = event.request.headers as Record<string, string>;
            for (const k of Object.keys(headers)) {
              if (shouldRedactRequestField(k)) headers[k] = '***REDACTED***';
            }
          }
        }
        if (event.user) {
          // Keep only the id; drop email/ip/username if present.
          event.user = { id: event.user.id };
        }
        return event;
      },
    });
    initialised = true;
    log.log('Sentry initialised');
  } catch (err) {
    sentry = null;
    initialised = false;
    log.warn(`Sentry init failed: ${(err as Error).message}`);
  }
}

export function captureExceptionSafe(err: unknown, ctx?: Record<string, unknown>): void {
  if (!sentry) return;
  try {
    if (ctx) {
      sentry.withScope((scope) => {
        for (const [k, v] of Object.entries(ctx)) scope.setTag(k, String(v));
        sentry!.captureException(err);
      });
    } else {
      sentry.captureException(err);
    }
  } catch {
    /* never let observability take down the request */
  }
}

export function isSentryEnabled(): boolean {
  return initialised;
}
