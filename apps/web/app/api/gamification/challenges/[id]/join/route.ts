import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../../../../lib/supabase-server';
import { joinChallenge } from '../../../../../../lib/gamification-persist';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

// POST /api/gamification/challenges/:id/join — join a community challenge.
export async function POST(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await joinChallenge(user.id, id);
  if (!result.ok) {
    const status = result.error === 'Challenge not found' ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
