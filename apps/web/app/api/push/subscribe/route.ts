import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isValidWebPushSubscription, pushConfigured } from '../../../../lib/push-core';

/**
 * Register / unregister a browser for push.
 *
 * ⚠️ A push subscription is a CAPABILITY: whoever holds the endpoint and keys
 * can make that device display a notification that looks like it came from
 * CharitMe. So the row is written against the session's own user id — never a
 * `userId` from the body, which would let anyone subscribe their own device to
 * somebody else's alerts and read their donation activity from the lock screen.
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  // A disabled feature should not advertise itself.
  if (!pushConfigured()) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { subscription?: unknown } | null;
  if (!isValidWebPushSubscription(body?.subscription)) {
    // The validator rejects non-HTTPS and loopback/private endpoints — an
    // unvalidated endpoint turns the send path into a request forger.
    return NextResponse.json({ error: 'Invalid subscription', code: 'INVALID_INPUT' }, { status: 400 });
  }
  const subscription = body!.subscription;

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        platform: 'web',
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
        failure_count: 0,
      },
      // Re-subscribing the same browser must UPDATE. Without this a user who
      // reinstalls the PWA twice receives every notification three times.
      { onConflict: 'endpoint' },
    );

  if (error) {
    console.warn('[push] subscribe failed', { code: error.code });
    return NextResponse.json({ error: 'Could not subscribe', code: 'WRITE_FAILED' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== 'string') {
    return NextResponse.json({ error: 'endpoint required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  // Scoped to the caller's own rows: an endpoint is guessable-ish and nobody
  // should be able to unsubscribe someone else's device.
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', body.endpoint);

  if (error) {
    return NextResponse.json({ error: 'Could not unsubscribe', code: 'WRITE_FAILED' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
