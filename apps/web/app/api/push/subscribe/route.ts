import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isSupportedEndpoint, shortUserAgent, pushConfigured } from '../../../../lib/push-core';

/**
 * Register or drop this DEVICE for web push.
 *
 * A subscription row is the opt-in — there is no separate preference column, so
 * DELETE here is the whole "turn push off" path (see the migration's note).
 */

const Schema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(200),
  }),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!pushConfigured(process.env)) {
    // Storing endpoints that can never be pushed to is worse than refusing: the
    // toggle would read "on" while nothing would ever arrive.
    return NextResponse.json({ error: 'Push is not configured on this deployment.' }, { status: 503 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  const { endpoint, keys } = parsed.data;

  // Same gate as the send path. A caller can post any URL here, and this row is
  // what the server later dials — so an unsupported host is rejected on the way
  // IN rather than discovered on the way out.
  if (!isSupportedEndpoint(endpoint)) {
    return NextResponse.json({ error: 'Unrecognized push endpoint' }, { status: 400 });
  }

  // Upsert on the endpoint: a browser returns the SAME endpoint until permission
  // is revoked, so re-registering must update the row, not add another one, or a
  // returning device collects a duplicate of every future alert.
  //
  // `user_id` is included in the update so an endpoint that moved to a different
  // account on a shared device follows it, instead of pushing that device's
  // alerts to whoever registered it first.
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: shortUserAgent(req.headers.get('user-agent')),
    }, { onConflict: 'endpoint' });

  if (error) {
    console.error('[push] could not store subscription', error);
    return NextResponse.json({ error: 'Could not save this device' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = z.object({ endpoint: z.string().max(2000) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  // Scoped to the caller: the endpoint alone is enough to push to a device, so
  // deleting by endpoint without an owner check would let anyone holding one
  // silently unsubscribe that device.
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', parsed.data.endpoint);

  if (error) return NextResponse.json({ error: 'Could not remove this device' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
