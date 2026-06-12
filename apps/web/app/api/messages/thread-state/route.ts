import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

const UpdateSchema = z.object({
  donorId: z.string().uuid(),
  archived: z.boolean().optional(),
  markRead: z.boolean().optional(),
});

// GET /api/messages/thread-state
// Returns the signed-in organizer's per-donor thread state (archived + last read).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('message_thread_state')
    .select('donor_id, archived, last_read_at')
    .eq('owner_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ threadState: data ?? [] });
}

// POST /api/messages/thread-state { donorId, archived?, markRead? }
// Upserts the read/archive state for a donor thread.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { donorId, archived, markRead } = parsed.data;

  const update: { owner_id: string; donor_id: string; archived?: boolean; last_read_at?: string; updated_at: string } = {
    owner_id: user.id,
    donor_id: donorId,
    updated_at: new Date().toISOString(),
  };
  if (archived !== undefined) update.archived = archived;
  if (markRead) update.last_read_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('message_thread_state')
    .upsert(update, { onConflict: 'owner_id,donor_id' })
    .select('donor_id, archived, last_read_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, threadState: data });
}
