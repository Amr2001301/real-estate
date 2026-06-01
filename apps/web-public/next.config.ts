import type { NextConfig } from 'next';

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

export default config;
