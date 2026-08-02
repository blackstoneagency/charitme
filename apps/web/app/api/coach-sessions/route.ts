import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase-server';
import { loadCoachSessions } from '../../../lib/coach-sessions-server';
import { summariseSessions, groupByCampaign } from '../../../lib/coach-sessions-core';

/**
 * Reader for `coach_sessions` — the coaching history behind `/dashboard/ai-coach`.
 *
 * The writer lives in `POST /api/ai/coach`, where the exchange actually happens.
 * There is no POST here: a session is a side effect of coaching, never something
 * a client declares on its own.
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const rows = await loadCoachSessions(supabase, user.id);
  // A read failure is a 503, never an empty history — "you have never asked a
  // question" is a claim, and this route would be making it up.
  if (rows === null) {
    return NextResponse.json({ error: 'History unavailable', code: 'READ_FAILED' }, { status: 503 });
  }

  return NextResponse.json({
    summary: summariseSessions(rows),
    byCampaign: groupByCampaign(rows),
  });
}
