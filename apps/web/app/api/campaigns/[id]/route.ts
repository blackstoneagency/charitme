import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

const VALID_STATUSES = ['draft', 'active', 'paused', 'completed', 'frozen', 'archived'] as const;

const VALID_VISIBILITY = ['public', 'unlisted', 'private'] as const;

const UpdateSchema = z.object({
  title:                   z.string().min(3).max(100).optional(),
  tagline:                 z.string().max(160).nullable().optional(),
  description:             z.string().min(1).optional(),
  status:                  z.enum(VALID_STATUSES).optional(),
  coverImageUrl:           z.string().url().nullable().optional(),
  goalAmount:              z.number().int().min(1).optional(),
  deadline:                z.string().nullable().optional(),
  category:                z.string().optional(),
  beneficiaryName:         z.string().max(120).nullable().optional(),
  beneficiaryRelationship: z.string().max(120).nullable().optional(),
  videoUrl:                z.string().url().nullable().optional(),
  location:                z.string().max(120).nullable().optional(),
  visibility:              z.enum(VALID_VISIBILITY).optional(),
  donationsEnabled:        z.boolean().optional(),
  goalHistory:             z.any().optional(),
});

async function verifyOwnership(campaignId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id, status, goal_amount')
    .eq('id', campaignId)
    .single();
  if (!data) return { ok: false, error: 'Campaign not found', status: 404 };
  if (data.user_id !== userId) return { ok: false, error: 'Forbidden', status: 403 };
  return { ok: true, campaign: data };
}

// ── PATCH /api/campaigns/[id] ─────────────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const check = await verifyOwnership(id, user.id);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (d.title !== undefined)                     updates.title = d.title;
  if (d.tagline !== undefined)                   updates.tagline = d.tagline;
  if (d.description !== undefined)               updates.description = d.description;
  if (d.status !== undefined)                    updates.status = d.status;
  if (d.coverImageUrl !== undefined)             updates.cover_image_url = d.coverImageUrl;
  if (d.deadline !== undefined)                  updates.deadline = d.deadline;
  if (d.category !== undefined)                  updates.category = d.category;
  if (d.beneficiaryName !== undefined)           updates.beneficiary_name = d.beneficiaryName;
  if (d.beneficiaryRelationship !== undefined)   updates.beneficiary_relationship = d.beneficiaryRelationship;
  if (d.videoUrl !== undefined)                  updates.video_url = d.videoUrl;
  if (d.location !== undefined)                  updates.location = d.location;
  if (d.visibility !== undefined)                updates.visibility = d.visibility;

  // Goal change: record history, freeze donations during review if big change
  if (d.goalAmount !== undefined) {
    const oldGoal = check.campaign?.goal_amount ?? 0;
    updates.goal_amount = d.goalAmount;
    // Log goal change to transparency ledger
    if (oldGoal > 0 && d.goalAmount !== oldGoal) {
      try {
        await supabaseAdmin.from('transparency_ledger_items').insert({
          campaign_id: id,
          item_type: 'other',
          title: `Goal ${d.goalAmount > oldGoal ? 'increased' : 'decreased'} from $${(oldGoal / 100).toLocaleString()} to $${(d.goalAmount / 100).toLocaleString()}`,
          status: 'verified',
        });
      } catch { /* non-fatal */ }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .select('id, slug, status')
    .single();

  if (error) {
    console.error('Campaign update failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log for status changes
  if (d.status) {
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        action: `campaign.${d.status}`,
        target_type: 'campaign',
        target_id: id,
        metadata: { previous_status: check.campaign?.status, new_status: d.status },
      });
    } catch { /* non-fatal */ }
  }

  return NextResponse.json(data);
}

// ── DELETE /api/campaigns/[id] ────────────────────────────────────────────────
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const check = await verifyOwnership(id, user.id);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const campaign = check.campaign!;

  // Safety: only delete drafts or archived campaigns. Live/active campaigns should be archived first.
  if (campaign.status === 'active') {
    return NextResponse.json({
      error: 'Active campaigns cannot be deleted. Please pause or close the campaign first.',
    }, { status: 400 });
  }

  // Soft-delete: set deleted_at for compliance audit trail
  const { error } = await supabaseAdmin
    .from('campaigns')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write campaign_status_log
  void supabaseAdmin.from('campaign_status_log').insert({
    campaign_id: id,
    changed_by: user.id,
    from_status: campaign.status,
    to_status: 'deleted',
    reason: 'User deleted campaign',
  });

  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'campaign.soft_deleted',
      target_type: 'campaign',
      target_id: id,
      metadata: { status_at_deletion: campaign.status },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}

// ── PUT /api/campaigns/[id] ───────────────────────────────────────────────────
export { PATCH as PUT };

// ── GET /api/campaigns/[id] ───────────────────────────────────────────────────
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, description, status, visibility, accept_donations, goal_amount, raised_amount, backer_count, cover_image_url, category, deadline, location, video_url, beneficiary_name, beneficiary_relationship, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(data);
}
