import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { ownedNonprofitIds } from '../../../../lib/giving-days-server';
import {
  isValidRuleSet,
  isContradictory,
  parseRules,
} from '../../../../lib/donor-segments-core';
import {
  getOwnedSegment,
  refreshSegmentMembers,
} from '../../../../lib/donor-segments-server';

/**
 * The writer `donor_segments` never had.
 *
 * These handlers use the service-role client, so `donor_segments_owner_private`
 * does not run. Ownership is established by intersecting the requested
 * `nonprofitId` with the caller's OWN nonprofit profiles on every path — read,
 * create, refresh and delete alike.
 */

const RulesSchema = z.object({
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  minLifetimeValueCents: z.number().int().min(0).optional(),
  maxLifetimeValueCents: z.number().int().min(0).optional(),
  donatedWithinDays: z.number().int().min(0).max(3650).optional(),
  notDonatedForDays: z.number().int().min(0).max(3650).optional(),
  requiresEmailConsent: z.boolean().optional(),
  requiresSmsConsent: z.boolean().optional(),
});

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  nonprofitId: z.string().uuid(),
  rules: RulesSchema,
});

const IdSchema = z.object({ id: z.string().uuid() });

async function caller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { user, owned: await ownedNonprofitIds(user.id) };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await caller();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid segment', code: 'INVALID_INPUT' }, { status: 400 });
  }
  const { name, nonprofitId, rules } = parsed.data;

  // Ownership before anything else — never after the write.
  if (!ctx.owned.includes(nonprofitId)) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }

  if (!isValidRuleSet(rules)) {
    return NextResponse.json({ error: 'Those rules are not valid', code: 'INVALID_RULES' }, { status: 400 });
  }
  // Well-formed but unsatisfiable. Saving it produces an empty segment the
  // fundraiser cannot explain, so it is refused with the reason.
  if (isContradictory(rules)) {
    return NextResponse.json(
      { error: 'Those rules contradict each other and would match nobody', code: 'CONTRADICTORY_RULES' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('donor_segments')
    .insert({ name, nonprofit_id: nonprofitId, rules })
    .select('id')
    .single();
  if (error) {
    console.warn('[segments] insert failed', { code: error.code });
    return NextResponse.json({ error: 'Could not save', code: 'WRITE_FAILED' }, { status: 503 });
  }

  const count = await refreshSegmentMembers(data.id as string, rules, nonprofitId);
  return NextResponse.json({
    ok: true,
    id: data.id,
    // `null` is reported as null, not as 0. The segment exists but its
    // membership was not written, and saying "0 members" would be a claim about
    // the contacts rather than about the failure.
    memberCount: count,
    membershipWritten: count !== null,
  });
}

/** Recompute an existing segment's membership from its saved rules. */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const ctx = await caller();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = IdSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'id required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const row = await getOwnedSegment(parsed.data.id, ctx.owned);
  // 404 rather than 403: confirming the id exists to someone who does not own it
  // is itself a leak.
  if (!row) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  const count = await refreshSegmentMembers(row.id, parseRules(row.rules), row.nonprofit_id);
  if (count === null) {
    return NextResponse.json({ error: 'Could not refresh', code: 'WRITE_FAILED' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, memberCount: count });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const ctx = await caller();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = IdSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'id required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const row = await getOwnedSegment(parsed.data.id, ctx.owned);
  if (!row) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  // Members go first. The foreign key is ON DELETE CASCADE so the database would
  // handle it, but doing it explicitly keeps the behaviour true if that
  // constraint is ever relaxed.
  await supabaseAdmin.from('donor_segment_members').delete().eq('segment_id', row.id);
  const { error } = await supabaseAdmin.from('donor_segments').delete().eq('id', row.id);
  if (error) return NextResponse.json({ error: 'Could not delete', code: 'WRITE_FAILED' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
