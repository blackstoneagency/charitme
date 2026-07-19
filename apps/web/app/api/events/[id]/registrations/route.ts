import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { listEventRegistrations } from '../../../../../lib/events';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/:id/registrations — attendee list (event organizer only).
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: event } = await supabaseAdmin
    .from('fundraising_events')
    .select('created_by')
    .eq('id', id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (event.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ registrations: await listEventRegistrations(id) });
}
