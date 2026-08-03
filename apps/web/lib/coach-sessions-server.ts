import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  shouldExtendSession,
  nextMessageCount,
  type CoachSessionRow,
} from './coach-sessions-core';

/**
 * Reader and writer for `coach_sessions`.
 *
 * ⚠️ These take the **session** client (`lib/supabase-server.ts`), not
 * `supabaseAdmin`. `coach_sessions` carries a real owner policy —
 * `coach_own_all`, `USING (auth.uid() = user_id) WITH CHECK (...)` — so RLS is a
 * live backstop here and reaching for the service role out of habit would throw
 * it away. Every statement is additionally scoped by `user_id` so the two
 * agree.
 */

const SELECT = 'id, campaign_id, message_count, created_at, updated_at';

/** `null` means the read FAILED — never conflated with "no sessions yet". */
export async function loadCoachSessions(
  supabase: SupabaseClient,
  userId: string,
  limit = 100,
): Promise<CoachSessionRow[] | null> {
  const { data, error } = await supabase
    .from('coach_sessions')
    .select(SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[coach-sessions] read failed', { code: error.code });
    return null;
  }
  return (data ?? []) as CoachSessionRow[];
}

/**
 * Record one coaching exchange — a question and its answer.
 *
 * Extends the most recent session when it is recent enough and about the same
 * campaign, otherwise starts a new one. Returns the session id, or `null` if
 * nothing could be written.
 *
 * **Never throws.** A coaching answer that reached the fundraiser must not be
 * turned into an error because bookkeeping failed afterwards — unlike the
 * donation webhook, where throwing is exactly right because Stripe retries and
 * `record_donation` is idempotent. There is no retry here and nothing to make
 * idempotent: the worst case is one uncounted question.
 */
export async function recordCoachExchange(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string | null,
  now: number = Date.now(),
): Promise<string | null> {
  try {
    const { data: recent, error: readError } = await supabase
      .from('coach_sessions')
      .select(SELECT)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // A failed lookup must not silently start a fresh session on every message —
    // that would inflate the conversation count without bound. Skip the write.
    if (readError) {
      console.warn('[coach-sessions] session lookup failed', { code: readError.code });
      return null;
    }

    const previous = (recent ?? null) as CoachSessionRow | null;
    const nowIso = new Date(now).toISOString();

    if (previous && shouldExtendSession(previous, campaignId, now)) {
      const { error } = await supabase
        .from('coach_sessions')
        .update({ message_count: nextMessageCount(previous.message_count), updated_at: nowIso })
        .eq('id', previous.id)
        .eq('user_id', userId);
      if (error) {
        console.warn('[coach-sessions] extend failed', { code: error.code });
        return null;
      }
      return previous.id;
    }

    const { data, error } = await supabase
      .from('coach_sessions')
      .insert({
        // From the session, never the request body.
        user_id: userId,
        campaign_id: campaignId,
        message_count: nextMessageCount(0),
        updated_at: nowIso,
      })
      .select('id')
      .single();
    if (error) {
      console.warn('[coach-sessions] insert failed', { code: error.code });
      return null;
    }
    return data.id as string;
  } catch (error) {
    console.warn('[coach-sessions] record failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}
