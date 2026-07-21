import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';

// Whitelisted, typed platform settings. Free-form config is never accepted raw.
const Schema = z.object({
  platformName: z.string().trim().max(120).optional(),
  tagline: z.string().trim().max(200).optional(),
  supportEmail: z.string().trim().email().max(200).optional().or(z.literal('')),
  supportPhone: z.string().trim().max(40).optional(),
  currency: z.string().trim().length(3).optional(),
  platformFeePercent: z.number().min(0).max(100).optional(),
  donationFeePercent: z.number().min(0).max(100).optional(),
  defaultDonorTipPercent: z.number().min(0).max(100).optional(),
  maintenanceMode: z.boolean().optional(),
  allowNewRegistrations: z.boolean().optional(),
});

// PATCH /api/admin/super/settings — merge into platform_settings.config (id=1).
export async function PATCH(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from('platform_settings').select('id, config').eq('id', 1).maybeSingle();
  const currentConfig = (existing?.config as Record<string, unknown> | null) ?? {};
  const nextConfig = { ...currentConfig, ...parsed.data };

  const { error } = existing
    ? await supabaseAdmin.from('platform_settings').update({ config: nextConfig }).eq('id', 1)
    : await supabaseAdmin.from('platform_settings').insert({ id: 1, config: nextConfig });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperAdminAction(guard.user.id, 'settings.update', 'platform_settings', null, { keys: Object.keys(parsed.data) });
  return NextResponse.json({ ok: true, config: nextConfig });
}
