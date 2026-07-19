import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';
import { allowedSponsorshipTransition, isSponsorshipRequestStatus, type SponsorshipRequestStatus } from '../../../../../lib/sponsorships';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  status: z.enum(['pending', 'accepted', 'declined', 'withdrawn', 'agreed', 'fulfilled']).optional(),
  deliverables: z.string().trim().max(2000).nullable().optional(),
}).refine((v) => v.status !== undefined || v.deliverables !== undefined, { message: 'No fields to update' });

// PATCH /api/sponsorships/requests/:id
// Sponsor (withdraw/agree), organizer (accept/decline/fulfill), or admin.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const { data: req } = await supabaseAdmin
    .from('sponsorship_requests')
    .select('id, opportunity_id, sponsor_id, status')
    .eq('id', id)
    .maybeSingle();
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = await isAdmin(user.id, user.email);
  let organizer = false;
  if (!admin && req.sponsor_id !== user.id) {
    const { data: opp } = await supabaseAdmin.from('sponsorship_opportunities').select('organizer_id').eq('id', req.opportunity_id).maybeSingle();
    organizer = opp?.organizer_id === user.id;
  }
  const isSponsor = req.sponsor_id === user.id;
  if (!admin && !organizer && !isSponsor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const actor: 'sponsor' | 'organizer' | 'admin' = admin ? 'admin' : organizer ? 'organizer' : 'sponsor';
  const update: Record<string, unknown> = {};

  if (parsed.data.status !== undefined) {
    const from = isSponsorshipRequestStatus(req.status) ? req.status : 'pending';
    const to = parsed.data.status as SponsorshipRequestStatus;
    if (from !== to && !allowedSponsorshipTransition(actor, from, to)) {
      return NextResponse.json({ error: `${actor} cannot change status from ${from} to ${to}`, code: 'INVALID_TRANSITION' }, { status: 409 });
    }
    update.status = to;
  }

  if (parsed.data.deliverables !== undefined) {
    // Only organizer/admin set deliverables terms.
    if (actor === 'sponsor') return NextResponse.json({ error: 'Only the organizer can set deliverables', code: 'DELIVERABLES_FORBIDDEN' }, { status: 403 });
    update.deliverables = parsed.data.deliverables;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('sponsorship_requests')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: updated });
}
