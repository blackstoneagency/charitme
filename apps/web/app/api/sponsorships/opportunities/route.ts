import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { listOpenOpportunities } from '../../../../lib/sponsorships';
import { OpportunityCreateSchema } from '../../../../lib/sponsorships-core';

// GET /api/sponsorships/opportunities?category=&search=
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const opportunities = await listOpenOpportunities({
    category: searchParams.get('category') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  });
  return NextResponse.json({ opportunities });
}

// POST /api/sponsorships/opportunities — organizer posts a sponsorship opportunity.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = OpportunityCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.campaign_id) {
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('user_id')
      .eq('id', input.campaign_id)
      .maybeSingle();
    if (!campaign || campaign.user_id !== user.id) {
      return NextResponse.json({ error: 'Campaign not found or not owned by you' }, { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('sponsorship_opportunities')
    .insert({
      organizer_id: user.id,
      campaign_id: input.campaign_id ?? null,
      title: input.title,
      description: input.description,
      category: input.category,
      benefits: input.benefits ?? null,
      min_amount_cents: input.min_amount_cents,
      target_amount_cents: input.target_amount_cents ?? null,
      currency: input.currency.toUpperCase(),
      status: input.status,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
