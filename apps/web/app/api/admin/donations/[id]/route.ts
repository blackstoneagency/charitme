import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';

type ProfileRow = { full_name: string | null; email: string | null } | null;
type CampaignRow = { id: string; title: string; slug: string } | null;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: raw, error } = await supabaseAdmin
    .from('donations')
    .select(
      'id, campaign_id, donor_id, amount_cents, status, anonymous, message,' +
      ' payment_method, source, notes, is_spam, receipt_sent_at, refunded_at, refund_reason,' +
      ' stripe_payment_intent_id, created_at,' +
      ' profiles!donor_id(full_name, email),' +
      ' campaigns!campaign_id(id, title, slug)',
    )
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'PGRST116' ? 404 : 500 },
    );
  }

  // Audit log for this donation
  const { data: auditData } = await supabaseAdmin
    .from('audit_logs')
    .select('id, actor_id, action, metadata, created_at')
    .eq('target_type', 'donation')
    .eq('target_id', id)
    .order('created_at', { ascending: false })
    .limit(25);

  const actorIds = [
    ...new Set(
      (auditData ?? [])
        .map((a: { actor_id: string }) => a.actor_id)
        .filter(Boolean),
    ),
  ] as string[];

  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', actorIds);
    for (const a of (actors ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      actorMap.set(a.id, a.full_name ?? a.email ?? 'Admin');
    }
  }

  const d = (raw as unknown) as Record<string, unknown>;
  const profile = (Array.isArray(d.profiles) ? d.profiles[0] : d.profiles) as ProfileRow;
  const campaign = (Array.isArray(d.campaigns) ? d.campaigns[0] : d.campaigns) as CampaignRow;

  const isAnon = Boolean(d.anonymous) || !d.donor_id;

  return NextResponse.json({
    id: d.id,
    campaignId: d.campaign_id,
    campaignTitle: campaign?.title ?? 'Unknown Campaign',
    campaignSlug: campaign?.slug ?? '',
    donorId: d.donor_id ?? null,
    donorName: isAnon ? 'Anonymous' : (profile?.full_name ?? profile?.email ?? 'Unknown Donor'),
    donorEmail: isAnon ? '' : (profile?.email ?? ''),
    amountCents: d.amount_cents as number,
    status: d.status as string,
    anonymous: Boolean(d.anonymous),
    message: (d.message as string | null) ?? '',
    paymentMethod: (d.payment_method as string | null) ?? null,
    source: (d.source as string | null) ?? null,
    notes: (d.notes as string | null) ?? null,
    isSpam: Boolean(d.is_spam),
    receiptSentAt: (d.receipt_sent_at as string | null) ?? null,
    refundedAt: (d.refunded_at as string | null) ?? null,
    refundReason: (d.refund_reason as string | null) ?? null,
    stripePaymentIntentId: (d.stripe_payment_intent_id as string | null) ?? null,
    createdAt: d.created_at as string,
    auditLog: (auditData ?? []).map((a: {
      id: string;
      actor_id: string;
      action: string;
      metadata: Record<string, unknown>;
      created_at: string;
    }) => ({
      id: a.id,
      action: a.action,
      actorName: actorMap.get(a.actor_id) ?? 'Admin',
      metadata: a.metadata,
      createdAt: a.created_at,
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };

  if (typeof body.notes === 'string') update.notes = body.notes.trim() || null;
  if (typeof body.is_spam === 'boolean') update.is_spam = body.is_spam;
  if (typeof body.receipt_sent_at === 'string') update.receipt_sent_at = body.receipt_sent_at;
  if (typeof body.refunded_at === 'string') update.refunded_at = body.refunded_at;
  if (typeof body.refund_reason === 'string') update.refund_reason = body.refund_reason;
  if (typeof body.status === 'string') {
    const allowed = new Set(['pending', 'completed', 'refunded', 'failed']);
    if (!allowed.has(body.status))
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    update.status = body.status;
  }

  if (Object.keys(update).length === 1)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('donations')
    .update(update)
    .eq('id', id)
    .select('id, status, notes, is_spam, receipt_sent_at, refunded_at, refund_reason')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from('audit_logs')
    .insert({
      actor_id: admin.id,
      action: 'donation.updated',
      target_type: 'donation',
      target_id: id,
      metadata: update,
      created_at: now,
    })
    .then(() => undefined);

  return NextResponse.json({ ok: true, donation: data });
}
