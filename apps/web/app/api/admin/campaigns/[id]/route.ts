import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';

const allowedStatuses    = new Set(['draft', 'active', 'paused', 'completed', 'rejected', 'frozen']);
// 'Trusted' is a valid DB value (between 'Under Review' and 'Verified')
const allowedTrustStatus = new Set(['Needs More Info', 'Under Review', 'Trusted', 'Verified', 'Flagged']);

const PatchSchema = z.object({
  // Core text fields
  title:       z.string().min(1).max(200).optional(),
  tagline:     z.string().max(300).nullable().optional(),
  description: z.string().optional(),
  category:    z.string().max(80).optional(),
  // Status fields
  status:      z.string().optional(),
  trust_status: z.string().optional(),
  // Booleans
  payout_frozen: z.boolean().optional(),
  featured:      z.boolean().optional(),
  pinned:        z.boolean().optional(),
  nonprofit_verified: z.boolean().optional(),
  // Numbers (stored as cents or 0-100)
  campaign_health_score: z.number().int().min(0).max(100).optional(),
  goal_amount: z.number().int().min(0).optional(),
  // Media fields — all optional, ignored if columns don't exist
  cover_image_url: z.string().url().nullable().optional(),
  image_urls:      z.array(z.string().url()).max(20).nullable().optional(),
  video_url:       z.string().url().nullable().optional(),
  // Other editable fields
  location:    z.string().max(200).nullable().optional(),
  deadline:    z.string().nullable().optional(),
  beneficiary_name: z.string().max(200).nullable().optional(),
}).strict();

// ── PATCH /api/admin/campaigns/[id] ──────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const body = parsed.data;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // --- String fields ---
  for (const key of ['title', 'tagline', 'description', 'category', 'location', 'beneficiary_name'] as const) {
    if (body[key] !== undefined) update[key] = body[key] === null ? null : String(body[key]).trim();
  }

  // --- Status: validated ---
  if (body.status !== undefined) {
    if (!allowedStatuses.has(body.status)) {
      return NextResponse.json({ error: `Invalid status "${body.status}". Allowed: ${[...allowedStatuses].join(', ')}` }, { status: 400 });
    }
    update.status = body.status;
  }

  // --- Trust status: validated ---
  if (body.trust_status !== undefined) {
    if (!allowedTrustStatus.has(body.trust_status)) {
      return NextResponse.json({ error: `Invalid trust_status "${body.trust_status}"` }, { status: 400 });
    }
    update.trust_status = body.trust_status;
  }

  // --- Booleans ---
  for (const key of ['payout_frozen', 'featured', 'pinned', 'nonprofit_verified'] as const) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  // --- Numbers ---
  if (body.campaign_health_score !== undefined) {
    update.campaign_health_score = Math.max(0, Math.min(100, Math.round(body.campaign_health_score)));
  }
  if (body.goal_amount !== undefined) {
    update.goal_amount = Math.max(0, Math.round(body.goal_amount));
  }

  // --- Media ---
  if (body.cover_image_url !== undefined) update.cover_image_url = body.cover_image_url;
  if (body.image_urls     !== undefined) update.image_urls      = body.image_urls ?? [];
  if (body.video_url      !== undefined) update.video_url       = body.video_url;

  // --- Deadline ---
  if (body.deadline !== undefined) update.deadline = body.deadline;

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update(update)
    .eq('id', id)
    .select('id, title, status, trust_status, payout_frozen, featured, pinned, campaign_health_score, goal_amount, cover_image_url, image_urls, video_url, updated_at')
    .single();

  if (error) {
    // If image_urls / video_url columns don't exist yet, retry without them
    const isMissingCol = error.code === '42703' || (error.message ?? '').includes('image_urls') || (error.message ?? '').includes('video_url');
    if (isMissingCol) {
      delete update.image_urls;
      delete update.video_url;
      const { data: data2, error: error2 } = await supabaseAdmin
        .from('campaigns')
        .update(update)
        .eq('id', id)
        .select('id, title, status, trust_status, payout_frozen, featured, pinned, campaign_health_score, goal_amount, cover_image_url, updated_at')
        .single();
      if (error2) return NextResponse.json({ error: error2.message }, { status: 500 });
      // Audit log (non-blocking)
      void (async () => { try { await supabaseAdmin.from('audit_logs').insert({ actor_id: admin.id, action: 'campaign.updated', target_type: 'campaign', target_id: id, metadata: update, created_at: new Date().toISOString() }); } catch { /* non-fatal */ } })();
      return NextResponse.json({ ok: true, campaign: data2, warning: 'image_urls/video_url not saved — run schema migration' });
    }
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  // Audit log (non-blocking — don't fail the request if audit table is missing)
  void (async () => {
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: admin.id, action: 'campaign.updated', target_type: 'campaign',
        target_id: id, metadata: update, created_at: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }
  })();

  return NextResponse.json({ ok: true, campaign: data });
}

// ── DELETE /api/admin/campaigns/[id] ─────────────────────────────────────────
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  void (async () => { try { await supabaseAdmin.from('audit_logs').insert({ actor_id: admin.id, action: 'campaign.deleted', target_type: 'campaign', target_id: id, metadata: {}, created_at: new Date().toISOString() }); } catch { /* non-fatal */ } })();

  return NextResponse.json({ ok: true });
}
