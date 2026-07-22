import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

// Per-route SEO overrides stored in public.seo_settings (RLS: service-role only).
const PUBLIC_ROUTE = z.string().trim().min(1).max(300).regex(/^\/(?!admin(?:\/|$)|dashboard(?:\/|$)|create(?:\/|$)|login(?:\/|$)|signup(?:\/|$)|forgot-password(?:\/|$)|profile(?:\/|$)|donor(?:\/|$)|donors(?:\/|$)|beneficiary(?:\/|$)|events\/manage(?:\/|$)|impact\/manage(?:\/|$)|matching\/manage(?:\/|$)|sponsor\/manage(?:\/|$))/);
const CANONICAL_URL = z.string().trim().max(1000).refine((value) => {
  if (value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.charitme.com';
  } catch {
    return false;
  }
}, 'Canonical URL must be a site-relative path or a CharitMe HTTPS URL');
const SeoSchema = z.object({
  id: z.string().uuid().optional(),
  route: PUBLIC_ROUTE,
  title: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
  keywords: z.string().max(500).optional().nullable(),
  ogTitle: z.string().max(200).optional().nullable(),
  ogDescription: z.string().max(500).optional().nullable(),
  ogImageUrl: z.string().max(1000).optional().nullable(),
  canonicalUrl: CANONICAL_URL.optional().nullable(),
  noindex: z.boolean().optional(),
});

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('seo_settings').select('*').order('route');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = SeoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const row = {
    route: d.route.trim(),
    title: d.title?.trim() || null,
    meta_description: d.metaDescription?.trim() || null,
    keywords: d.keywords?.trim() || null,
    og_title: d.ogTitle?.trim() || null,
    og_description: d.ogDescription?.trim() || null,
    og_image_url: d.ogImageUrl?.trim() || null,
    canonical_url: d.canonicalUrl?.trim() || null,
    noindex: d.noindex ?? false,
    updated_by: admin.id,
    updated_at: new Date().toISOString(),
  };

  // Upsert keyed on `route` without relying on a DB unique constraint.
  const { data: existing } = await supabaseAdmin.from('seo_settings').select('id').eq('route', row.route).maybeSingle();
  const targetId = d.id ?? existing?.id;
  const result = targetId
    ? await supabaseAdmin.from('seo_settings').update(row).eq('id', targetId).select().single()
    : await supabaseAdmin.from('seo_settings').insert(row).select().single();

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json(result.data);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await supabaseAdmin.from('seo_settings').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
