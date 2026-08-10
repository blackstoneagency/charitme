import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { pushConfigured } from '../../../../lib/push';

/**
 * Register / remove a Web Push subscription for the signed-in user.
 *
 * ⚠️ AUTHENTICATED, and it must be. A subscription is a capability to buzz
 * somebody's phone; an anonymous endpoint would let anyone attach a device to
 * any account they could name. `user_id` comes from the SESSION and is never
 * read from the body — that is the whole access-control story here.
 *
 * ⚠️ Auth is `supabase.auth.getUser()`, NOT `requireUser()`. The page helper
 * REDIRECTS an unauthenticated visitor, which for an API caller means a 307 to
 * /login where a 401 was expected — a fetch() sees an opaque HTML response and
 * cannot tell "signed out" from "broken". `api-auth-methods.test.ts` caught the
 * first version of this file doing exactly that.
 */

export const dynamic = 'force-dynamic';

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000).refine((v) => v.startsWith('https://'), {
    message: 'endpoint must be https',
  }),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 503 rather than 500: the client can tell "the server cannot do this yet"
  // from "the server broke", and the UI hides the control instead of offering
  // something that will never work.
  if (!pushConfigured()) {
    return NextResponse.json({ error: 'PUSH_NOT_CONFIGURED' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 300);

  try {
    // Upsert on `endpoint`: re-subscribing on the same device returns the same
    // endpoint, and a second row would deliver every notification twice to one
    // phone. The upsert also re-points a device to whoever is signed in now and
    // clears `expired_at`, so a device that was marked gone comes back to life
    // instead of staying silently dead.
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: userAgent,
        expired_at: null,
      }, { onConflict: 'endpoint' });

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'PUSH_TABLE_MISSING' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Could not save subscription' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not save subscription' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const endpoint = (body as { endpoint?: unknown })?.endpoint;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  }

  try {
    // Scoped to the caller's own rows. Without the user_id predicate, knowing
    // any endpoint string would let one account unsubscribe another's device.
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);
    if (error && error.code !== '42P01') {
      return NextResponse.json({ error: 'Could not remove subscription' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not remove subscription' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
