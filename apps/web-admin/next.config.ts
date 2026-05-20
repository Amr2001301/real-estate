import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Emit a self-contained server bundle at .next/standalone for Docker images.
  // Local `next dev` / `next start` are unaffected.
  output: 'standalone',
  async rewrites() {
    const api = process.env.API_BASE_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${api}/v1/:path*`,
      },
    ];
  },
};

// Source-map upload is opt-in: it only runs when all three build-time secrets
// are present (SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT). Without them we
// export the plain Next config, so local/dev/CI builds never load the Sentry
// build plugin, never emit upload noise, and never fail on a missing token.
const hasSentryUpload = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT,
);

export default hasSentryUpload
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Optional explicit release name; otherwise the SDK derives one from git.
      ...(process.env.SENTRY_RELEASE
        ? { release: { name: process.env.SENTRY_RELEASE } }
        : {}),
      // Quiet locally; verbose only in CI where the logs are useful.
      silent: !process.env.CI,
      // We don't send build telemetry to Sentry.
      telemetry: false,
      // Upload a wider set of client bundles so stack frames resolve fully.
      widenClientFileUpload: true,
      sourcemaps: {
        // Delete emitted .map files after upload so they aren't served publicly.
        deleteSourcemapsAfterUpload: true,
      },
    })
  : config;
