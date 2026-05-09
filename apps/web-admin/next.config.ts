import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
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
