import 'server-only';
import type { Metadata } from 'next';
import { supabaseAdmin } from './supabase';

export type SeoRow = {
  route: string; title: string | null; meta_description: string | null; keywords: string | null;
  og_title: string | null; og_description: string | null; og_image_url: string | null;
  canonical_url: string | null; noindex: boolean;
};

/** Fetch the SEO override row for a route, or null. `seo_settings` is service-role only. */
export async function getSeoForRoute(route: string): Promise<SeoRow | null> {
  try {
    const { data } = await supabaseAdmin
      .from('seo_settings')
      .select('route, title, meta_description, keywords, og_title, og_description, og_image_url, canonical_url, noindex')
      .eq('route', route)
      .maybeSingle();
    return (data as SeoRow | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Merge a route's super-admin SEO overrides onto a base Metadata object. Only
 * fields the admin actually set are applied — everything else falls back to
 * `base`. Safe to call in any page's generateMetadata.
 */
export async function seoMetadata(route: string, base: Metadata = {}): Promise<Metadata> {
  const row = await getSeoForRoute(route);
  if (!row) return base;

  const title = row.title || undefined;
  const description = row.meta_description || undefined;
  const ogTitle = row.og_title || title;
  const ogDescription = row.og_description || description;

  return {
    ...base,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(row.keywords ? { keywords: row.keywords } : {}),
    ...(row.noindex ? { robots: { index: false, follow: false } } : {}),
    ...(row.canonical_url ? { alternates: { ...(base.alternates ?? {}), canonical: row.canonical_url } } : {}),
    openGraph: {
      ...(base.openGraph ?? {}),
      ...(ogTitle ? { title: ogTitle } : {}),
      ...(ogDescription ? { description: ogDescription } : {}),
      ...(row.og_image_url ? { images: [{ url: row.og_image_url }] } : {}),
    },
  };
}
