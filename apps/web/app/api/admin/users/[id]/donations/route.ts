import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../_auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, status, created_at, campaigns(title)')
    .eq('donor_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  type DonationRow = {
    id: string;
    amount_cents: number;
    status: string;
    created_at: string;
    campaigns: { title: string } | { title: string }[] | null;
  };

  const donations = (data ?? []).map((row: DonationRow) => {
    const camp = row.campaigns;
    const campaignTitle = Array.isArray(camp)
      ? (camp[0]?.title ?? 'Unknown Campaign')
      : (camp?.title ?? 'Unknown Campaign');
    return {
      id: row.id,
      amountCents: row.amount_cents,
      status: row.status,
      campaignTitle,
      createdAt: row.created_at,
    };
  });

  return NextResponse.json({ donations });
}
