import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const targetType = searchParams.get('target_type') ?? '';
  const targetId = searchParams.get('target_id') ?? '';
  const rawLimit = searchParams.get('limit');
  const limit = Math.min(Math.max(1, parseInt(rawLimit ?? '50', 10) || 50), 200);

  let query = supabaseAdmin
    .from('audit_logs')
    .select('id, actor_id, action, target_type, target_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (targetType) query = query.eq('target_type', targetType);
  if (targetId) query = query.eq('target_id', targetId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  // Resolve actor names
  const actorIds = [
    ...new Set((data ?? []).map((a: { actor_id: string }) => a.actor_id).filter(Boolean)),
  ] as string[];
  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', actorIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      actorMap.set(p.id, p.full_name ?? p.email ?? 'Admin');
    }
  }

  const entries = (data ?? []).map((a: {
    id: string;
    actor_id: string;
    action: string;
    target_type: string;
    target_id: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }) => ({
    id: a.id,
    action: a.action,
    targetType: a.target_type,
    targetId: a.target_id,
    actorName: actorMap.get(a.actor_id) ?? 'Admin',
    metadata: a.metadata,
    createdAt: a.created_at,
  }));

  return NextResponse.json(entries);
}
