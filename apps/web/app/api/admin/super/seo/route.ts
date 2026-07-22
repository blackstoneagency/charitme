import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';

const PUBLIC_ROUTE = z.string().trim().min(1).max(200).regex(/^\/(?!admin(?:\/|$)|dashboard(?:\/|$)|create(?:\/|$)|login(?:\/|$)|signup(?:\/|$)|forgot-password(?:\/|$)|profile(?:\/|$)|donor(?:\/|$)|donors(?:\/|$)|beneficiary(?:\/|$)|events\/manage(?:\/|$)|impact\/manage(?:\/|$)|matching\/manage(?:\/|$)|sponsor\/manage(?:\/|$))/);
const CANONICAL_URL = z.string().trim().max(500).refine((value) => {
  if (value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.charitme.com';
  } catch {
    return false;
  }
}, 'Canonical URL must be a site-relative path or a CharitMe HTTPS URL');
const Schema = z.object({
  route: PUBLIC_ROUTE,
  title: z.string().trim().max(200).optional().nullable(),
  meta_description: z.string().trim().max(500).optional().nullable(),
  keywords: z.string().trim().max(500).optional().nullable(),
  og_title: z.string().trim().max(200).optional().nullable(),
  og_description: z.string().trim().max(500).optional().nullable(),
  og_image_url: z.string().trim().max(500).optional().nullable(),
  canonical_url: CANONICAL_URL.optional().nullable(),
  noindex: z.boolean().optional(),
});

// POST /api/admin/super/seo — upsert per-route SEO settings.
export async function POST(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const row = { ...parsed.data, noindex: parsed.data.noindex ?? false, updated_by: guard.user.id };
  const { data, error } = await supabaseAdmin
    .from('seo_settings')
    .upsert(row, { onConflict: 'route' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperAdminAction(guard.user.id, 'seo.upsert', 'seo_settings', data.id, { route: parsed.data.route });
  return NextResponse.json({ ok: true, row: data });
}

// DELETE /api/admin/super/seo?id=<uuid>
export async function DELETE(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await supabaseAdmin.from('seo_settings').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logSuperAdminAction(guard.user.id, 'seo.delete', 'seo_settings', id, {});
  return NextResponse.json({ ok: true });
}
