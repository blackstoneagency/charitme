import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { listUserRequests } from '../../../../lib/privacy';
import { RequestCreateSchema } from '../../../../lib/privacy-core';

// GET /api/privacy/requests — the signed-in user's privacy requests.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ requests: await listUserRequests(user.id) });
}

// POST /api/privacy/requests — file a new privacy request (export or deletion).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = RequestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { type, note } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from('privacy_requests')
    .insert({ user_id: user.id, type, note: note ?? null, status: 'pending' })
    .select('id')
    .single();

  if (error) {
    // Partial-unique violation → an active request of this type already exists.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `You already have an open ${type} request.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
