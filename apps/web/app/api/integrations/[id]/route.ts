import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

// DELETE /api/integrations/[id] — disconnect (delete) an integration
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Ensure the row belongs to this user before deleting
  const { data: existing } = await supabaseAdmin
    .from('integration_connections')
    .select('id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('integration_connections')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// PATCH /api/integrations/[id] — pause/resume an integration
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = (body as Record<string, unknown>).status as string | undefined;
  if (!status || !['connected', 'paused'].includes(status)) {
    return NextResponse.json({ error: 'status must be "connected" or "paused"' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('integration_connections')
    .select('id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('integration_connections')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  return NextResponse.json({ ok: true, connection: updated });
}
