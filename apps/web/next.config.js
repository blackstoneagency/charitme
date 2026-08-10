/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: `${__dirname}/../..`,
  // ssh2 (via ssh2-sftp-client, used by the FL Sunbiz connector) ships a
  // native .node binary that webpack can't bundle — keep it external so
  // it's loaded via require() at runtime in the serverless function.
  serverExternalPackages: ['ssh2-sftp-client', 'ssh2'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // CC0 campaign covers assigned by scripts/assign-campaign-photos.mjs.
      { protocol: 'https', hostname: 'images.rawpixel.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        // NOTE: framing/clickjacking headers (X-Frame-Options,
        // Content-Security-Policy: frame-ancestors) are intentionally set in
        // middleware.ts, not here, so the campaign embed route can stay
        // frame-able by third parties while the rest of the site is locked
        // to same-origin. Setting X-Frame-Options here would override that.
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
