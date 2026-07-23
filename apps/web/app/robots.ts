import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/admin/',
          '/api/',
          '/create',
          '/login',
          '/signup',
          '/forgot-password',
          '/profile',
          '/achievements',
          '/privacy-center',
          '/donor$',
          '/beneficiary/',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
