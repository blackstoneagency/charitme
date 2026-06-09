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
          '/profile',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
