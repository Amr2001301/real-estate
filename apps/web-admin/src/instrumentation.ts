/**
 * Next.js server + edge runtime instrumentation hook.
 * Sentry initialises only when SENTRY_DSN is set; the app boots normally
 * without it.
 *
 * Client-side init lives in src/instrumentation-client.ts.
 */
export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
      // Server-side: scrub headers + bodies before send.
      beforeSend(event) {
        if (event.request) {
          event.request.data = undefined;
          event.request.cookies = undefined;
          event.request.query_string = undefined;
        }
        if (event.user) event.user = { id: event.user.id };
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
    });
  }
}
