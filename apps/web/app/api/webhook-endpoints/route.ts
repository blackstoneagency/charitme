import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { checkRateLimitDurable } from '../../../lib/rate-limit-durable';
import {
  generateWebhookSecret,
  isWebhookEvent,
  validateWebhookUrl,
} from '../../../lib/webhook-endpoint-access';

export const dynamic = 'force-dynamic';

// `secret_hash` is deliberately absent from every response. It is not secret
// enough to be useful to its owner (they need the plaintext, shown once at
// creation) and it is exactly what an attacker would want.
const SELECT = 'id, owner_id, url, events, active, created_at, updated_at';

const CreateSchema = z.object({
  url: z.string().min(8).max(2000),
  events: z.array(z.string().max(60)).min(1).max(20),
});

// ── GET /api/webhook-endpoints ──────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('outbound_webhook_endpoints')
    .select(SELECT)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: 'Could not load your webhook endpoints', code: 'ENDPOINTS_UNAVAILABLE' },
      { status: 503 },
    );
  }
  return NextResponse.json({ endpoints: data ?? [] });
}

// ── POST /api/webhook-endpoints ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await checkRateLimitDurable(`webhook-endpoint-create:${user.id}`, 20, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many endpoints created', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid endpoint', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const urlCheck = validateWebhookUrl(parsed.data.url);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.reason, code: 'INVALID_URL' }, { status: 400 });
  }

  // An unknown event name would be stored and never matched, so the subscriber
  // would wait for a delivery that is never attempted.
  const unknown = parsed.data.events.filter((e) => !isWebhookEvent(e));
  if (unknown.length) {
    return NextResponse.json(
      { error: `Unknown events: ${unknown.join(', ')}`, code: 'UNKNOWN_EVENT' },
      { status: 400 },
    );
  }

  const { secret, hash } = generateWebhookSecret();

  const { data, error } = await supabaseAdmin
    .from('outbound_webhook_endpoints')
    .insert({
      owner_id: user.id,
      url: urlCheck.url,
      events: parsed.data.events,
      secret_hash: hash,
      active: true,
    })
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not create the endpoint', code: 'CREATE_FAILED' }, { status: 500 });
  }

  // The only time the plaintext secret exists outside this function. It cannot
  // be recovered later — only the hash is stored — so the UI must show it now.
  return NextResponse.json({ endpoint: data, secret }, { status: 201 });
}
