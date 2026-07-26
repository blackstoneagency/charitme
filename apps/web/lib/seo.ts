import 'server-only';
import type { Metadata } from 'next';
import { supabaseAdmin } from './supabase';

export type SeoRow = {
  route: string; title: string | null; meta_description: string | null; keywords: string | null;
  og_title: string | null; og_description: string | null; og_image_url: string | null;
  canonical_url: string | null; noindex: boolean;
};

/**
 * Fetch the SEO override row for a route, or null. `seo_settings` is service-role only.
 *
 * Never throws. The override is *optional enrichment* — a page already carries its
 * own metadata, and failing to reach Supabase must degrade to that, not delete it.
 *
 * It used to throw, and the consequence was invisible: `generateMetadata` rejects,
 * Next.js drops metadata for the whole route, and the page still renders with **no
 * `<title>`, description, canonical or OG tags at all** — a silent WCAG 2.4.2 (Page
 * Titled) failure plus total SEO loss, with nothing in the logs to attribute it to.
 *
 * Measured on a production build with Supabase env unset: `/` served 89KB of correct
 * homepage markup, h1 "Raise More.", and zero meta tags. After this change the same
 * build serves `<title>CharitMe | Raise More Faster With AI</title>`.
 *
 * Scope, precisely: the trigger there is `supabaseAdmin` throwing on *construction*
 * when its env vars are unset, so this bites misconfigured deploys and any build
 * without credentials — including CI, where it would fail the `document-title` rule
 * in e2e/accessibility.spec.ts. A correctly configured production does not hit that
 * path; there the guard covers fetch-level exceptions, which the `{ data }`
 * destructure below does not catch. This is hardening plus a real fix for
 * credential-less builds — not a claim that production is currently losing titles.
 */
export async function getSeoForRoute(route: string): Promise<SeoRow | null> {
  try {
    const { data } = await supabaseAdmin
      .from('seo_settings')
      .select('route, title, meta_description, keywords, og_title, og_description, og_image_url, canonical_url, noindex')
      .eq('route', route)
      .maybeSingle();
    return (data as SeoRow | null) ?? null;
  } catch {
    // Deliberately swallowed: the caller's own metadata is the correct answer when
    // the override is unavailable, and metadata generation must not fail the route.
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

  // Every route gets a self-referencing canonical by default (resolved against
  // the layout's metadataBase) to avoid duplicate-content ambiguity — unless the
  // caller's base or a super-admin override supplies a specific one.
  const canonical = row?.canonical_url || base.alternates?.canonical || route;
  const alternates = { ...(base.alternates ?? {}), canonical };

  if (!row) return { ...base, alternates };

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
    alternates,
    openGraph: {
      ...(base.openGraph ?? {}),
      ...(ogTitle ? { title: ogTitle } : {}),
      ...(ogDescription ? { description: ogDescription } : {}),
      ...(row.og_image_url ? { images: [{ url: row.og_image_url }] } : {}),
    },
  };
}
