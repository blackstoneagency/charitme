import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { listPublishedEvents } from '../../../lib/events';
import { EventCreateSchema, slugifyTitle } from '../../../lib/events-core';

export const dynamic = 'force-dynamic';

// GET /api/events — public list of published events (soonest first).
export async function GET() {
  return NextResponse.json({ events: await listPublishedEvents(60) });
}

// POST /api/events — organizer creates an event.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = EventCreateSchema.safeParse(body);
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

  const slug = `${slugifyTitle(input.title)}-${Math.random().toString(36).slice(2, 7)}`;

  const { data, error } = await supabaseAdmin
    .from('fundraising_events')
    .insert({
      created_by: user.id,
      campaign_id: input.campaign_id ?? null,
      title: input.title,
      slug,
      description: input.description ?? null,
      event_type: input.event_type,
      starts_at: input.starts_at,
      ends_at: input.ends_at ?? null,
      location: input.location ?? null,
      virtual_url: input.virtual_url ?? null,
      cover_image_url: input.cover_image_url ?? null,
      capacity: input.capacity ?? null,
      status: input.status,
    })
    .select('id, slug')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, slug: data.slug }, { status: 201 });
}
