import 'server-only';
import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { listPublishedEvents } from '../../../lib/events';
import { EventCreateSchema, slugifyTitle } from '../../../lib/events-core';
import { checkRateLimitDurable } from '../../../lib/rate-limit-durable';

export const dynamic = 'force-dynamic';

// GET /api/events — public list of published events (soonest first).
export async function GET() {
  return NextResponse.json({ events: await listPublishedEvents(60) });
}

// POST /api/events — organizer creates an event.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  if (!(await checkRateLimitDurable(`event-create:${user.id}`, 12, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many event creation attempts', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = EventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.campaign_id) {
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('user_id')
      .eq('id', input.campaign_id)
      .maybeSingle();
    if (campaignError) {
      return NextResponse.json({ error: 'Campaign ownership could not be verified', code: 'CAMPAIGN_LOOKUP_UNAVAILABLE' }, { status: 503 });
    }
    if (!campaign || campaign.user_id !== user.id) {
      return NextResponse.json({ error: 'Campaign not found or not owned by you', code: 'FORBIDDEN' }, { status: 403 });
    }
  }

  const slug = `${slugifyTitle(input.title)}-${randomUUID().replaceAll('-', '').slice(0, 8)}`;

  const { data, error } = await supabaseAdmin.rpc('create_event_with_tickets', {
    p_created_by: user.id,
    p_campaign_id: input.campaign_id ?? null,
    p_title: input.title,
    p_slug: slug,
    p_description: input.description ?? null,
    p_event_type: input.event_type,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at ?? null,
    p_location: input.location ?? null,
    p_virtual_url: input.virtual_url ?? null,
    p_cover_image_url: input.cover_image_url ?? null,
    p_capacity: input.capacity ?? null,
    p_status: input.status,
    p_tickets: input.tickets,
  });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  const createdValue: unknown = Array.isArray(data) ? data[0] : null;
  if (!createdValue || typeof createdValue !== 'object') {
    return NextResponse.json({ error: 'Internal server error', code: 'INVALID_CREATE_RESULT' }, { status: 500 });
  }
  const created = createdValue as Record<string, unknown>;
  if (typeof created.event_id !== 'string' || typeof created.event_slug !== 'string') {
    return NextResponse.json({ error: 'Internal server error', code: 'INVALID_CREATE_RESULT' }, { status: 500 });
  }
  return NextResponse.json({ id: created.event_id, slug: created.event_slug }, { status: 201 });
}
