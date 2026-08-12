/**
 * Next.js client-side instrumentation. Initialises Sentry in the browser only
 * when NEXT_PUBLIC_SENTRY_DSN is set at build time. Dead-code-eliminated in
 * builds without a DSN — no Sentry bundle cost in dev.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0'),
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
