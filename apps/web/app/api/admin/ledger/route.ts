import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';
import { getCampaignLedger, getDonationLedger } from '../../../../lib/ledger';

export const dynamic = 'force-dynamic';

// GET /api/admin/ledger?campaignId=  |  ?donationId=
// Admin/finance view of immutable ledger entries + open reconciliation exceptions.
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaignId');
  const donationId = searchParams.get('donationId');

  const entries = donationId
    ? await getDonationLedger(donationId)
    : campaignId
      ? await getCampaignLedger(campaignId)
      : [];

  const { data: exceptions } = await supabaseAdmin
    .from('reconciliation_exceptions')
    .select('id, kind, status, description, expected_cents, actual_cents, difference_cents, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(100);

  return NextResponse.json({ entries, openExceptions: exceptions ?? [] });
}
