import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  requestType: z.enum(['export', 'deletion']),
  details: z.string().trim().max(1000).optional(),
});

// GET /api/privacy/requests — the caller's privacy requests.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('privacy_requests')
    .select('id, request_type, status, details, resolution_note, requested_at, resolved_at')
    .eq('user_id', user.id)
    .order('requested_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

// POST /api/privacy/requests { requestType, details? } — file an export/deletion request.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const { requestType, details } = parsed.data;

  // Enforce one active request per type (matches the partial unique index).
  const { data: active } = await supabaseAdmin
    .from('privacy_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('request_type', requestType)
    .in('status', ['pending', 'processing'])
    .maybeSingle();
  if (active) {
    return NextResponse.json({ error: `You already have an open ${requestType} request`, code: 'ALREADY_OPEN' }, { status: 409 });
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('privacy_requests')
    .insert({ user_id: user.id, request_type: requestType, details: details ?? null, status: 'pending' })
    .select('id, request_type, status, details, requested_at')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit the request (best-effort).
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: user.id,
    action: `privacy_request.${requestType}.created`,
    target_type: 'privacy_request',
    target_id: inserted?.id ?? null,
    metadata: { requestType },
  }).then(() => {}, () => {});

  return NextResponse.json({ request: inserted }, { status: 201 });
}
