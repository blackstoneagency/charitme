import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CharitMe — Intelligent Fundraising',
    short_name: 'CharitMe',
    description: 'Create trusted fundraising campaigns in seconds with CharitMe AI. 0% platform fees.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbfaff',
    theme_color: '#6d35ff',
    orientation: 'portrait-primary',
    categories: ['finance', 'social', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
