import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  output: 'standalone',
  experimental: {
    // Default is 1mb — avatar uploads flow through a server action, so the
    // multipart body must fit. Mirrors the 5MB cap enforced by the backend.
    serverActions: { bodySizeLimit: '5mb' },
  },
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

// Source-map upload is opt-in: only runs when all three build-time secrets are
// present. Without them the plain Next config is exported — local/dev/CI builds
// are unaffected and never fail on a missing token.
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
      ...(process.env.SENTRY_RELEASE ? { release: { name: process.env.SENTRY_RELEASE } } : {}),
      silent: !process.env.CI,
      widenClientFileUpload: true,
    })
  : config;
