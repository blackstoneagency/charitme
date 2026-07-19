import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { GRANT_DETAIL_COLUMNS } from '../../../../lib/grants';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/grants/[id] — fetch one grant by id or slug (public: open/upcoming only).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const query = supabaseAdmin
    .from('grants')
    .select(GRANT_DETAIL_COLUMNS)
    .is('deleted_at', null)
    .in('status', ['open', 'upcoming']);

  const { data, error } = await (UUID_RE.test(id)
    ? query.eq('id', id)
    : query.eq('slug', id)
  ).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

  // Additional deadlines are public info about a public grant.
  const { data: deadlines } = await supabaseAdmin
    .from('grant_deadlines')
    .select('id, label, kind, due_at')
    .eq('grant_id', (data as unknown as { id: string }).id)
    .order('due_at', { ascending: true });

  return NextResponse.json({ grant: data, deadlines: deadlines ?? [] });
}
