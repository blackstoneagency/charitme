import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CharitMe — Intelligent Fundraising',
    short_name: 'CharitMe',
    description: 'Create trusted fundraising campaigns in seconds with CharitMe AI. 0% platform fees.',
    start_url: '/',
    // Pins app identity to '/' explicitly. Without `id`, identity is DERIVED from
    // start_url, so ever changing start_url would mint a second installable app
    // rather than update the installed one.
    id: '/',
    display: 'standalone',
    background_color: '#fbfaff',
    theme_color: '#6d35ff',
    // `portrait-primary` locked the installed app out of landscape entirely,
    // including on tablets. `portrait` still prefers portrait but permits
    // portrait-secondary, and does not fight a user who rotates the device.
    orientation: 'portrait',
    categories: ['finance', 'social', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
