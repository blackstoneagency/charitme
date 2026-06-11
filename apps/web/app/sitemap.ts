import { MetadataRoute } from 'next';
import { BLOG_POSTS } from '../lib/blog-posts';

const BASE = 'https://www.charitme.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { url: BASE,                        priority: 1.0,  changeFrequency: 'daily'   as const },
    { url: `${BASE}/campaigns`,         priority: 0.9,  changeFrequency: 'hourly'  as const },
    { url: `${BASE}/leaderboard`,       priority: 0.75, changeFrequency: 'hourly'  as const },
    { url: `${BASE}/create`,            priority: 0.9,  changeFrequency: 'weekly'  as const },
    { url: `${BASE}/pricing`,           priority: 0.85, changeFrequency: 'weekly'  as const },
    { url: `${BASE}/features`,          priority: 0.8,  changeFrequency: 'weekly'  as const },
    { url: `${BASE}/how-it-works`,      priority: 0.8,  changeFrequency: 'weekly'  as const },
    { url: `${BASE}/for-nonprofits`,    priority: 0.8,  changeFrequency: 'weekly'  as const },
    { url: `${BASE}/for-donors`,        priority: 0.75, changeFrequency: 'weekly'  as const },
    { url: `${BASE}/for-individuals`,   priority: 0.75, changeFrequency: 'weekly'  as const },
    { url: `${BASE}/ai-fundraising`,    priority: 0.8,  changeFrequency: 'weekly'  as const },
    { url: `${BASE}/ai-campaign`,       priority: 0.75, changeFrequency: 'weekly'  as const },
    { url: `${BASE}/about-us`,          priority: 0.7,  changeFrequency: 'monthly' as const },
    { url: `${BASE}/blog`,              priority: 0.7,  changeFrequency: 'weekly'  as const },
    { url: `${BASE}/success-stories`,   priority: 0.65, changeFrequency: 'weekly'  as const },
    { url: `${BASE}/help`,              priority: 0.65, changeFrequency: 'weekly'  as const },
    { url: `${BASE}/faq`,               priority: 0.6,  changeFrequency: 'weekly'  as const },
    { url: `${BASE}/fast-payouts`,      priority: 0.6,  changeFrequency: 'weekly'  as const },
    { url: `${BASE}/contact`,           priority: 0.6,  changeFrequency: 'monthly' as const },
    { url: `${BASE}/supported-countries`, priority: 0.5, changeFrequency: 'monthly' as const },
    { url: `${BASE}/trust-safety`,      priority: 0.5,  changeFrequency: 'monthly' as const },
    { url: `${BASE}/terms`,             priority: 0.4,  changeFrequency: 'yearly'  as const },
    { url: `${BASE}/privacy`,           priority: 0.4,  changeFrequency: 'yearly'  as const },
    { url: `${BASE}/security`,          priority: 0.4,  changeFrequency: 'yearly'  as const },
    { url: `${BASE}/prohibited-use`,    priority: 0.3,  changeFrequency: 'yearly'  as const },
  ].map(r => ({ ...r, lastModified: new Date() }));

  const blogRoutes = BLOG_POSTS.map(p => ({
    url: `${BASE}/blog/${p.slug}`,
    priority: 0.6,
    changeFrequency: 'monthly' as const,
    lastModified: new Date(`${p.publishedAt}T00:00:00`),
  }));

  return [...staticRoutes, ...blogRoutes];
}
