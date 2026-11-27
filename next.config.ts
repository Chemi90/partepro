import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  outputFileTracingExcludes: { '*': ['./.env*', './.local/**/*'] },
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '16kb' } },
};
export default nextConfig;
