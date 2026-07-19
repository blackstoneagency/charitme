import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().max(5000).optional(),
  benefits: z.union([z.string(), z.array(z.string())]).optional(),
  minAmountCents: z.number().int().min(0).max(1_000_000_000).optional(),
  slots: z.number().int().min(1).max(1000).optional(),
  campaignId: z.string().uuid().optional(),
  status: z.enum(['draft', 'open']).optional(),
});

function parseBenefits(raw: string | string[] | undefined): string[] {
  const arr = Array.isArray(raw) ? raw : (raw ?? '').split(',');
  return [...new Set(arr.map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 80))].slice(0, 20);
}

// GET /api/sponsorships/opportunities?mine=1 — public list of open packages (or the caller's own).
export async function GET(request: NextRequest) {
  const mine = new URL(request.url).searchParams.get('mine') === '1';
  let query = supabaseAdmin
    .from('sponsorship_opportunities')
    .select('id, organizer_id, campaign_id, title, description, benefits, min_amount_cents, currency, slots, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (mine) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    query = query.eq('organizer_id', user.id);
  } else {
    query = query.eq('status', 'open');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunities: data ?? [] });
}

// POST /api/sponsorships/opportunities — organizer posts a sponsorship package.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  if (d.campaignId) {
    const { data: campaign } = await supabaseAdmin.from('campaigns').select('user_id').eq('id', d.campaignId).maybeSingle();
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('sponsorship_opportunities')
    .insert({
      organizer_id: user.id,
      campaign_id: d.campaignId ?? null,
      title: d.title,
      description: d.description ?? null,
      benefits: parseBenefits(d.benefits),
      min_amount_cents: d.minAmountCents ?? 0,
      slots: d.slots ?? 1,
      status: d.status ?? 'open',
    })
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunity: inserted }, { status: 201 });
}
