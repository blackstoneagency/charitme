import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../users/_auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('campaign_updates')
    .select('id, title, body, ai_generated, created_at, user_id, profiles!user_id(full_name, email)')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const updates = (data ?? []).map((u) => {
    const profile = Array.isArray(u.profiles) ? u.profiles[0] : u.profiles;
    return {
      id: u.id,
      title: u.title ?? '',
      body: u.body,
      aiGenerated: u.ai_generated,
      createdAt: u.created_at,
      authorName: (profile as { full_name?: string | null; email?: string | null } | null)?.full_name
        ?? (profile as { full_name?: string | null; email?: string | null } | null)?.email
        ?? 'Unknown',
    };
  });

  return NextResponse.json(updates);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const updateBody = typeof body.body === 'string' ? body.body.trim() : '';
  if (!updateBody) return NextResponse.json({ error: 'Update body is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('campaign_updates')
    .insert({
      campaign_id: id,
      user_id: admin.id,
      title: typeof body.title === 'string' ? body.title.trim() || null : null,
      body: updateBody,
      ai_generated: false,
    })
    .select('id, title, body, ai_generated, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, update: data }, { status: 201 });
}
