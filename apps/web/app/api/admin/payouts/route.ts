import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isAdmin } from '../../../../lib/roles';

async function verifyAdmin(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const allowed = await isAdmin(user.id, user.email);
    if (!allowed) return null;
    return user.id;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '0', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const status = searchParams.get('status');

  let query = supabaseAdmin
    .from('payouts')
    .select('id,campaign_id,user_id,amount_cents,payout_speed,status,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ payouts: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const adminId = await verifyAdmin();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { user_id, campaign_id, amount_cents, payout_method, note } = body as {
    user_id?: string;
    campaign_id?: string;
    amount_cents?: number;
    payout_method?: string;
    note?: string;
  };

  if (!user_id || !amount_cents || amount_cents <= 0) {
    return NextResponse.json({ error: 'user_id and amount_cents are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('payouts')
    .insert({
      user_id,
      campaign_id: campaign_id ?? null,
      amount_cents,
      payout_speed: payout_method ?? 'standard',
      status: 'requested',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log the note if provided (audit trail)
  if (note && data) {
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: adminId,
        action: 'payout.created',
        resource_type: 'payout',
        resource_id: (data as { id: string }).id,
        metadata: { note, amount_cents, manual: true },
        created_at: new Date().toISOString(),
      });
    } catch { /* ignore audit log failures */ }
  }

  return NextResponse.json({ payout: data }, { status: 201 });
}
