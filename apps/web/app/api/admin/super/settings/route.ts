import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';
import { FEATURE_PRICE_MIN_CENTS, FEATURE_PRICE_MAX_CENTS } from '../../../../../lib/featured';

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
  maintenanceMessage: z.string().trim().max(240).optional(),
  maintenanceExpectedBackAt: z.string().trim().max(40).refine(
    (value) => value === '' || Number.isFinite(Date.parse(value)),
    'Expected return time must be a valid date and time',
  ).optional(),
  allowNewRegistrations: z.boolean().optional(),
  // The one-time fee a creator pays to be featured in the homepage rotator.
  // In CENTS on the wire — the UI collects dollars and converts, because a
  // number field that silently means a different unit at each end is how a $5
  // fee becomes a $500 one. Bounded by the same constants the resolver clamps to.
  featuredCampaignPriceCents: z
    .number()
    .int()
    .min(FEATURE_PRICE_MIN_CENTS)
    .max(FEATURE_PRICE_MAX_CENTS)
    .optional(),
});

// PATCH /api/admin/super/settings — merge into platform_settings.config (id=1).
export async function PATCH(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from('platform_settings').select('id, config').eq('id', 1).maybeSingle();
  const currentConfig = (existing?.config as Record<string, unknown> | null) ?? {};

  // The featured price lives at `config.payment.featuredCampaignPriceCents`,
  // which is where `resolveFeaturePriceCents` reads it and where /admin/settings
  // writes it. This merge is SHALLOW, so writing the key at the top level would
  // save a value nothing ever reads — the setting would appear to work and
  // change nothing. Lift it into `payment` explicitly, preserving the other
  // payment keys that page owns.
  const { featuredCampaignPriceCents, ...flat } = parsed.data;
  const nextConfig: Record<string, unknown> = { ...currentConfig, ...flat };

  if (featuredCampaignPriceCents !== undefined) {
    const currentPayment =
      currentConfig.payment && typeof currentConfig.payment === 'object' && !Array.isArray(currentConfig.payment)
        ? (currentConfig.payment as Record<string, unknown>)
        : {};
    nextConfig.payment = { ...currentPayment, featuredCampaignPriceCents };
  }

  const { error } = existing
    ? await supabaseAdmin.from('platform_settings').update({ config: nextConfig }).eq('id', 1)
    : await supabaseAdmin.from('platform_settings').insert({ id: 1, config: nextConfig });
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  revalidateTag('platform-settings');
  await logSuperAdminAction(guard.user.id, 'settings.update', 'platform_settings', null, { keys: Object.keys(parsed.data) });
  return NextResponse.json({ ok: true, config: nextConfig });
}
