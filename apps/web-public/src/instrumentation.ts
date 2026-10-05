/**
 * Next.js server + edge runtime instrumentation.
 * Sentry initialises only when SENTRY_DSN is set; the app boots normally
 * without it. Client-side init lives in instrumentation-client.ts.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // --cpu-prof writes the profile only on a normal process exit (process.exit()).
    // SIGTERM without a handler goes through the OS default, which terminates the
    // process without calling Node's exit path, silently dropping the profile.
    // Register a handler so the CI "kill -SIGTERM" step produces the artifact.
    process.on('SIGTERM', () => process.exit(0));

    // Event-loop lag probe — fires every 50ms; logs when observed lag > 100ms.
    // If the loop is saturated during the /account render this prints continuously
    // through that window. Zero output means the loop was free and saturation is
    // ruled out. Remove with the rest of the instrumentation commit.
    const EXPECTED_MS = 50;
    let last = process.hrtime.bigint();
    setInterval(() => {
      const now = process.hrtime.bigint();
      const lag = Number(now - last) / 1e6 - EXPECTED_MS;
      if (lag > 100) {
        console.log(`[loop-lag] ${new Date().toISOString()} ${lag.toFixed(0)}ms`);
      }
      last = now;
    }, EXPECTED_MS).unref();
  }

  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
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
