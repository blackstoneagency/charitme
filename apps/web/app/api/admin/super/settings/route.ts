import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';
import { FEATURE_PRICE_MIN_CENTS, FEATURE_PRICE_MAX_CENTS } from '../../../../../lib/featured';
import { MAX_DONATION_CENTS, MIN_DONATION_CENTS } from '@shared/fees';
import { boundedQuery } from '../../../../../lib/query-timeout';

const MethodFeeSchema = z.object({
  pct: z.number().min(0).max(20),
  fixed: z.number().int().min(0).max(10_000),
  cap: z.number().int().min(0).max(100_000).optional(),
  label: z.string().max(60).optional(),
});

const DonationCheckoutSchema = z.object({
  amountPresetsCents: z
    .array(z.number().int().min(MIN_DONATION_CENTS).max(MAX_DONATION_CENTS))
    .length(6)
    .refine((values) => new Set(values).size === values.length, 'Donation amounts must be unique'),
  popularAmountCents: z.number().int().min(MIN_DONATION_CENTS).max(MAX_DONATION_CENTS),
  supportTierPercents: z
    .array(z.number().min(0).max(100))
    .length(8)
    .refine((values) => new Set(values).size === values.length, 'CharitMe fee choices must be unique')
    .refine((values) => values.includes(0), 'CharitMe fee choices must include 0%'),
  defaultSupportPercent: z.number().min(0).max(100),
  methodFees: z.object({
    stripe: MethodFeeSchema,
    gpay: MethodFeeSchema,
    bank: MethodFeeSchema,
    card: MethodFeeSchema,
  }),
}).superRefine((value, context) => {
  if (!value.amountPresetsCents.includes(value.popularAmountCents)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['popularAmountCents'], message: 'Most popular amount must be one of the six choices' });
  }
  if (!value.supportTierPercents.includes(value.defaultSupportPercent)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['defaultSupportPercent'], message: 'Default CharitMe fee must be one of the eight choices' });
  }
});

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
  donationCheckout: DonationCheckoutSchema.optional(),
});

// PATCH /api/admin/super/settings — merge into platform_settings.config (id=1).
export async function PATCH(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: existing, error: lookupError } = await boundedQuery(() =>
    supabaseAdmin.from('platform_settings').select('id, config').eq('id', 1).maybeSingle(),
  );
  if (lookupError) {
    return NextResponse.json(
      { error: 'Settings are temporarily unavailable', code: 'SETTINGS_LOOKUP_UNAVAILABLE' },
      { status: 503 },
    );
  }
  const currentConfig = (existing?.config as Record<string, unknown> | null) ?? {};

  // The featured price lives at `config.payment.featuredCampaignPriceCents`,
  // which is where `resolveFeaturePriceCents` reads it and where /admin/settings
  // writes it. This merge is SHALLOW, so writing the key at the top level would
  // save a value nothing ever reads — the setting would appear to work and
  // change nothing. Lift it into `payment` explicitly, preserving the other
  // payment keys that page owns.
  const { featuredCampaignPriceCents, donationCheckout, ...flat } = parsed.data;
  const nextConfig: Record<string, unknown> = { ...currentConfig, ...flat };

  if (featuredCampaignPriceCents !== undefined || donationCheckout !== undefined) {
    const currentPayment =
      currentConfig.payment && typeof currentConfig.payment === 'object' && !Array.isArray(currentConfig.payment)
        ? (currentConfig.payment as Record<string, unknown>)
        : {};
    nextConfig.payment = {
      ...currentPayment,
      ...(featuredCampaignPriceCents !== undefined ? { featuredCampaignPriceCents } : {}),
      ...(donationCheckout !== undefined ? { donationCheckout } : {}),
    };
  }

  const write = {
    config: nextConfig,
    updated_at: new Date().toISOString(),
    updated_by: guard.user.id,
  };
  const { error } = existing
    ? await supabaseAdmin.from('platform_settings').update(write).eq('id', 1)
    : await supabaseAdmin.from('platform_settings').insert({ id: 1, ...write });
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  revalidateTag('platform-settings');
  revalidateTag('donation-checkout-settings');
  await logSuperAdminAction(guard.user.id, 'settings.update', 'platform_settings', null, { keys: Object.keys(parsed.data) });
  return NextResponse.json({ ok: true, config: nextConfig });
}
