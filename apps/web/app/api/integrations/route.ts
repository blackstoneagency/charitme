import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';

// GET /api/integrations — list user's connections
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('integration_connections')
    .select('id,provider,status,config,created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  return NextResponse.json({ connections: data ?? [] });
}

// POST /api/integrations — create or update a connection
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).provider !== 'string'
  ) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }

  const { provider, config } = body as { provider: string; config?: Record<string, string> };

  const providerNorm = provider.trim().toLowerCase();
  if (!providerNorm) {
    return NextResponse.json({ error: 'provider cannot be empty' }, { status: 400 });
  }

  // Upsert: if a connection for this provider already exists, update it
  const { data: existing } = await supabaseAdmin
    .from('integration_connections')
    .select('id')
    .eq('owner_id', user.id)
    .eq('provider', providerNorm)
    .single();

  if (existing) {
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('integration_connections')
      .update({ status: 'connected', config: config ?? {}, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, connection: updated });
  }

  const { data: created, error: insErr } = await supabaseAdmin
    .from('integration_connections')
    .insert({ owner_id: user.id, provider: providerNorm, status: 'connected', config: config ?? {} })
    .select()
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, connection: created }, { status: 201 });
}
