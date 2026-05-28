import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../users/_auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, message, anonymous, status, created_at, donor_id, profiles!donor_id(full_name, email)')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const donations = (data ?? []).map((d) => {
    const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
    return {
      id: d.id,
      amountCents: d.amount_cents,
      message: d.message ?? '',
      anonymous: d.anonymous,
      status: d.status,
      createdAt: d.created_at,
      donorName: d.anonymous
        ? 'Anonymous'
        : ((profile as { full_name?: string | null; email?: string | null } | null)?.full_name
            ?? (profile as { full_name?: string | null; email?: string | null } | null)?.email
            ?? 'Unknown'),
    };
  });

  return NextResponse.json(donations);
}
