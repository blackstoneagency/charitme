import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/admin',
          '/api',
          '/achievements',
          '/create',
          '/login',
          '/signup',
          '/forgot-password',
          '/profile',
          '/privacy-center',
          '/donor',
          '/donors/',
          '/beneficiary',
          '/events/manage',
          '/impact/manage',
          '/matching/manage',
          '/sponsor/manage',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
