/** @type {import('next').NextConfig} */
const nextConfig = {
  // ssh2 (via ssh2-sftp-client, used by the FL Sunbiz connector) ships a
  // native .node binary that webpack can't bundle — keep it external so
  // it's loaded via require() at runtime in the serverless function.
  serverExternalPackages: ['ssh2-sftp-client', 'ssh2'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
