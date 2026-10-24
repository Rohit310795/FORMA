import type { NextConfig } from 'next';

/**
 * The admin console is a static single-page app (served by Firebase Hosting).
 * It holds no secrets: every privileged action goes through the `adminApi`
 * Cloud Function, which verifies the caller's role server-side.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: false,
  images: { unoptimized: true },
  transpilePackages: ['@forma/shared'],
  reactStrictMode: true,
};

export default nextConfig;
