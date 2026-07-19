import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isChallengeLive } from '../../../../../lib/challenges';

export const dynamic = 'force-dynamic';

// POST /api/challenges/:id/join — join (idempotent) or leave (?action=leave).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = new URL(request.url).searchParams.get('action');

  const { data: challenge } = await supabaseAdmin
    .from('challenges')
    .select('id, status, starts_at, ends_at')
    .eq('id', id)
    .maybeSingle();
  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

  if (action === 'leave') {
    const { error } = await supabaseAdmin.from('challenge_participants').delete().eq('challenge_id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ joined: false });
  }

  if (!isChallengeLive(challenge.status, challenge.starts_at, challenge.ends_at)) {
    return NextResponse.json({ error: 'This challenge is not open to join', code: 'NOT_LIVE' }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('challenge_participants')
    .upsert({ challenge_id: id, user_id: user.id }, { onConflict: 'challenge_id,user_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ joined: true });
}
