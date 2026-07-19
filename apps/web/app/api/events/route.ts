import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  title: z.string().trim().min(4).max(140),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).min(3).max(80).optional(),
  eventType: z.enum(['fundraiser', 'gala', 'giving_day', 'livestream', 'auction', 'registration']).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  location: z.string().trim().max(200).optional(),
  virtualUrl: z.string().url().max(500).optional(),
  campaignId: z.string().uuid().optional(),
  status: z.enum(['draft', 'published']).optional(),
});

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || `event-${Date.now()}`;
}

// GET /api/events?mine=1 — published events (or the caller's own drafts+published).
export async function GET(request: NextRequest) {
  const mine = new URL(request.url).searchParams.get('mine') === '1';
  const cols = 'id, title, slug, event_type, starts_at, ends_at, location, virtual_url, status, campaign_id, created_at';

  if (mine) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Owner = creator of the linked campaign (events reference campaigns/nonprofits).
    const { data: myCampaigns } = await supabaseAdmin.from('campaigns').select('id').eq('user_id', user.id);
    const ids = (myCampaigns ?? []).map((c) => c.id);
    if (ids.length === 0) return NextResponse.json({ events: [] });
    const { data, error } = await supabaseAdmin.from('fundraising_events').select(cols).in('campaign_id', ids).neq('status', 'cancelled').order('starts_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data ?? [] });
  }

  const { data, error } = await supabaseAdmin
    .from('fundraising_events')
    .select(cols)
    .eq('status', 'published')
    .order('starts_at', { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

// POST /api/events — create an event tied to a campaign the caller owns.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  if (!d.campaignId) return NextResponse.json({ error: 'A campaign is required to host an event', code: 'CAMPAIGN_REQUIRED' }, { status: 400 });
  const { data: campaign } = await supabaseAdmin.from('campaigns').select('user_id').eq('id', d.campaignId).maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const slug = d.slug ? d.slug : `${slugify(d.title)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: inserted, error } = await supabaseAdmin
    .from('fundraising_events')
    .insert({
      campaign_id: d.campaignId,
      title: d.title,
      slug,
      event_type: d.eventType ?? 'fundraiser',
      starts_at: d.startsAt,
      ends_at: d.endsAt ?? null,
      location: d.location ?? null,
      virtual_url: d.virtualUrl ?? null,
      status: d.status ?? 'draft',
    })
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: inserted }, { status: 201 });
}
