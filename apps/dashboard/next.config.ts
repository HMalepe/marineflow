import type { NextConfig } from 'next';

const upstreamApi = (
  process.env.API_UPSTREAM_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000'
).replace(/\/$/, '');

const nextConfig: NextConfig = {
  /**
   * Same-origin proxy to the MarineFlow API. Browser requests stay on
   * dashboard.marineflow.co.za so restrictive workplace/corporate WiFi
   * (which often blocks cross-origin calls to the API domain) still works.
   */
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${upstreamApi}/api/:path*`,
      },
      {
        source: '/admin/backend/:path*',
        destination: `${upstreamApi}/admin/:path*`,
      },
      {
        source: '/agency/backend/:path*',
        destination: `${upstreamApi}/agency/:path*`,
      },
    ];
  },
};

export default nextConfig;
