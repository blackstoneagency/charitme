import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { isAdmin } from '../../../../../lib/roles';
import { createClient } from '../../../../../lib/supabase-server';
import { escapeCsvCell } from '../../../../../lib/csv';

async function verifyAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    return isAdmin(user.id, user.email);
  } catch {
    return false;
  }
}

function rowToCsv(row: Record<string, unknown>): string {
  return Object.values(row).map(escapeCsvCell).join(',');
}

export async function POST(request: NextRequest) {
  const isAllowed = await verifyAdmin();
  if (!isAllowed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { reportId } = body as { reportId?: string };

  if (!reportId || typeof reportId !== 'string') {
    return NextResponse.json({ error: 'reportId is required' }, { status: 400 });
  }

  // Map reportId to a Supabase query
  type Row = Record<string, unknown>;
  let rows: Row[] = [];
  let headers: string[] = [];

  if (reportId === 'donation-summary' || reportId === 'donation-trends' || reportId === 'recurring-donations') {
    const { data } = await supabaseAdmin
      .from('donations')
      .select('id, amount_cents, status, donor_id, campaign_id, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(5000);
    rows = ((data ?? []) as Row[]).map(r => ({
      id: r.id,
      amount_usd: typeof r.amount_cents === 'number' ? (r.amount_cents / 100).toFixed(2) : '0.00',
      status: r.status,
      donor_id: r.donor_id,
      campaign_id: r.campaign_id,
      created_at: r.created_at,
    }));
    headers = ['id', 'amount_usd', 'status', 'donor_id', 'campaign_id', 'created_at'];
  } else if (reportId === 'campaign-performance') {
    const { data } = await supabaseAdmin
      .from('campaigns')
      .select('id, title, status, raised_amount, goal_amount, category, created_at')
      .order('raised_amount', { ascending: false })
      .limit(5000);
    rows = ((data ?? []) as Row[]).map(r => ({
      id: r.id,
      title: r.title,
      status: r.status,
      raised_usd: typeof r.raised_amount === 'number' ? (r.raised_amount / 100).toFixed(2) : '0.00',
      goal_usd: typeof r.goal_amount === 'number' ? (r.goal_amount / 100).toFixed(2) : '0.00',
      category: r.category,
      created_at: r.created_at,
    }));
    headers = ['id', 'title', 'status', 'raised_usd', 'goal_usd', 'category', 'created_at'];
  } else if (reportId === 'user-activity' || reportId === 'top-donors') {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    rows = (data ?? []) as Row[];
    headers = ['id', 'full_name', 'email', 'plan', 'created_at'];
  } else if (reportId === 'payout-summary') {
    const { data } = await supabaseAdmin
      .from('payouts')
      .select('id, amount_cents, status, campaign_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    rows = ((data ?? []) as Row[]).map(r => ({
      id: r.id,
      amount_usd: typeof r.amount_cents === 'number' ? (r.amount_cents / 100).toFixed(2) : '0.00',
      status: r.status,
      campaign_id: r.campaign_id,
      created_at: r.created_at,
    }));
    headers = ['id', 'amount_usd', 'status', 'campaign_id', 'created_at'];
  } else {
    // Webhook events for system/engagement reports
    const { data } = await supabaseAdmin
      .from('webhook_events')
      .select('id, event_type, stripe_event_id, processed_at, processing_error, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    rows = (data ?? []) as Row[];
    headers = ['id', 'event_type', 'stripe_event_id', 'processed_at', 'processing_error', 'created_at'];
  }

  // Build CSV
  const csvLines = [
    headers.join(','),
    ...rows.map(r => rowToCsv(Object.fromEntries(headers.map(h => [h, r[h] ?? ''])))),
  ];
  const csv = csvLines.join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${reportId}-${Date.now()}.csv"`,
    },
  });
}
