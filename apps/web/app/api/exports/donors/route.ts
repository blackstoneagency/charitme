import 'server-only';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { toCsv } from '../../../../lib/csv';

const HEADERS = ['donor_name', 'email', 'tags', 'total_donated_usd', 'donations_count', 'last_donation_date'];

function csvResponse(body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="donors-export-${Date.now()}.csv"`,
    },
  });
}

// GET /api/exports/donors
// Returns a CSV of donors across the user's campaigns, deduplicated by
// donor account (or grouped as Anonymous), including CRM tags.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('user_id', user.id);

  const cids = (campaigns ?? []).map((c: { id: string }) => c.id);
  if (cids.length === 0) {
    return csvResponse(`${HEADERS.join(',')}\n`);
  }

  const { data: donations } = await supabaseAdmin
    .from('donations')
    .select('donor_id, offline_donor_name, amount_cents, anonymous, created_at')
    .in('campaign_id', cids)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  type Donation = {
    donor_id: string | null;
    offline_donor_name: string | null;
    amount_cents: number;
    anonymous: boolean;
    created_at: string;
  };
  const rows = (donations ?? []) as Donation[];

  // Look up profiles for known, non-anonymous donors
  const knownDonorIds = [...new Set(rows.filter(d => d.donor_id && !d.anonymous).map(d => d.donor_id as string))];
  const profileMap = new Map<string, { name: string; email: string }>();
  if (knownDonorIds.length > 0) {
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', knownDonorIds);
    for (const p of (profileData ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      profileMap.set(p.id, { name: p.full_name ?? 'Donor', email: p.email ?? '' });
    }
  }

  // Look up CRM tags for this organizer's donor contacts
  const { data: contactData } = await supabaseAdmin
    .from('donor_crm_contacts')
    .select('email, tags')
    .eq('owner_id', user.id)
    .is('nonprofit_id', null);

  const tagsByEmail = new Map<string, string[]>();
  for (const c of (contactData ?? []) as { email: string | null; tags: string[] | null }[]) {
    if (!c.email) continue;
    tagsByEmail.set(c.email.toLowerCase(), c.tags ?? []);
  }

  // Aggregate by donor account (anonymous donations grouped under "Anonymous")
  const donorMap = new Map<string, { name: string; email: string; total: number; count: number; lastDate: string }>();
  for (const d of rows) {
    const isAnon = d.anonymous || !d.donor_id;
    const key = isAnon ? 'anonymous' : d.donor_id!;
    const profile = d.donor_id ? (profileMap.get(d.donor_id) ?? null) : null;
    const existing = donorMap.get(key);
    if (existing) {
      existing.total += d.amount_cents;
      existing.count += 1;
      if (d.created_at > existing.lastDate) existing.lastDate = d.created_at;
    } else {
      donorMap.set(key, {
        name: isAnon ? 'Anonymous' : (profile?.name ?? d.offline_donor_name ?? 'Donor'),
        email: isAnon ? '' : (profile?.email ?? ''),
        total: d.amount_cents,
        count: 1,
        lastDate: d.created_at,
      });
    }
  }

  const csvRows = Array.from(donorMap.values())
    .sort((a, b) => b.total - a.total)
    .map((d) => ({
      donor_name: d.name,
      email: d.email,
      tags: d.email ? (tagsByEmail.get(d.email.toLowerCase()) ?? []).join('; ') : '',
      total_donated_usd: (d.total / 100).toFixed(2),
      donations_count: d.count,
      last_donation_date: d.lastDate,
    }));

  return csvResponse(toCsv(csvRows, HEADERS));
}
