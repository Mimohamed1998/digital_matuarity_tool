import type { NextConfig } from 'next';

const SECURITY_HEADERS = [
  // Stop a browser from second-guessing a Content-Type — the export routes send text/csv
  // and application/json, and neither should ever be sniffed into something executable.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The admin pages must never be framed; there is nothing here worth embedding.
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
