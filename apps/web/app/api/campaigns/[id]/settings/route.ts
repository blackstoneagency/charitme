import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isSupportedCurrency } from '@shared/currencies';
import { canManageCampaign } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

const SettingsSchema = z.object({
  fundingModel:  z.enum(['flexible', 'fixed']).optional(),
  launchType:    z.enum(['fundraiser', 'project', 'product', 'indemand']).optional(),
  currency:      z.string().length(3).toUpperCase()
                   .refine(isSupportedCurrency, 'Unsupported currency')
                   .optional(),
  country:       z.string().length(2).toUpperCase().optional(),
  isIndemand:    z.boolean().optional(),
  productStage:  z.string().max(100).nullable().optional(),
});

async function verifyOwner(campaignId: string, user: { id: string; email?: string | null }) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id')
    .eq('id', campaignId)
    .single();
  if (!data) return { ok: false as const, status: 404, error: 'Campaign not found' };
  if (!(await canManageCampaign(user, data.user_id))) return { ok: false as const, status: 403, error: 'Forbidden' };
  return { ok: true as const };
}

// ── GET /api/campaigns/[id]/settings ─────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const check = await verifyOwner(id, user);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { data, error } = await supabaseAdmin
    .from('campaign_launch_settings')
    .select('id, funding_model, launch_type, currency, country, is_indemand, product_stage, created_at, updated_at')
    .eq('campaign_id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return defaults if no settings row yet
  if (!data) {
    return NextResponse.json({
      campaign_id: id,
      funding_model: 'flexible',
      launch_type: 'fundraiser',
      currency: 'USD',
      country: 'US',
      is_indemand: false,
      product_stage: null,
    });
  }

  return NextResponse.json(data);
}

// ── PATCH /api/campaigns/[id]/settings ────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const check = await verifyOwner(id, user);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json().catch(() => null);
  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const row: Record<string, unknown> = { campaign_id: id, updated_at: new Date().toISOString() };
  if (d.fundingModel  !== undefined) row.funding_model  = d.fundingModel;
  if (d.launchType    !== undefined) row.launch_type    = d.launchType;
  if (d.currency      !== undefined) row.currency       = d.currency;
  if (d.country       !== undefined) row.country        = d.country;
  if (d.isIndemand    !== undefined) row.is_indemand    = d.isIndemand;
  if (d.productStage  !== undefined) row.product_stage  = d.productStage;

  const { data, error } = await supabaseAdmin
    .from('campaign_launch_settings')
    .upsert(row, { onConflict: 'campaign_id' })
    .select('id, funding_model, launch_type, currency, country, is_indemand, product_stage, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
