/**
 * Next.js 15 client-side instrumentation entry. Picked up automatically by the
 * framework. Initialises Sentry on the browser only if a public DSN is set.
 *
 * The Sentry SDK is loaded via dynamic import so it is not bundled into the
 * shared chunks when NEXT_PUBLIC_SENTRY_DSN is empty at build time. Next.js
 * inlines NEXT_PUBLIC_* values at build, so the `if (dsn)` branch becomes
 * dead-code-eliminated in builds without a DSN configured.
 *
 * Server secrets are never read here — only NEXT_PUBLIC_* values are visible.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0'),
      // Don't ship request bodies or query strings from breadcrumbs.
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
          if (breadcrumb.data) {
            delete breadcrumb.data.request_body_size;
            delete breadcrumb.data.response_body_size;
          }
        }
        return breadcrumb;
      },
    });
  });
}
