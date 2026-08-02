import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { isAdmin } from '../../../lib/roles';
import {
  canManageGivingDay,
  givingDaySlug,
  isValidWindow,
  POLICY_MIRRORED,
} from '../../../lib/giving-days-core';
import { ownedNonprofitIds } from '../../../lib/giving-days-server';

/**
 * The writer `giving_days` never had.
 *
 * ⚠️ These handlers use the SERVICE-ROLE client, which bypasses RLS. The
 * `giving_days_owner_write` policy therefore does not run here, and
 * `canManageGivingDay` is not a convenience check in front of the database's
 * decision — it IS the decision. It mirrors that policy deliberately
 * (see POLICY_MIRRORED) and every path below goes through it.
 */

const CreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  nonprofitId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  goalAmountCents: z.number().int().min(0).max(1_000_000_00).nullable().optional(),
});

const DeleteSchema = z.object({ id: z.string().uuid() });

async function actorFor(request: NextRequest) {
  void request;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [admin, owned] = await Promise.all([
    isAdmin(user.id, user.email),
    ownedNonprofitIds(user.id),
  ]);
  return { userId: user.id, isAdmin: admin, ownedNonprofitIds: owned };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const actor = await actorFor(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid giving day', code: 'INVALID_INPUT' }, { status: 400 });
  }
  const { title, nonprofitId, startsAt, endsAt, goalAmountCents } = parsed.data;

  // Authorize against the row we are about to WRITE, not against one we read.
  // Checking after the insert would be checking the wrong thing.
  if (!canManageGivingDay(actor, { nonprofit_id: nonprofitId })) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }

  // The database has no CHECK for this — a row with ends_at before starts_at
  // would insert happily and then render as permanently "ended".
  if (!isValidWindow({ startsAt, endsAt })) {
    return NextResponse.json(
      { error: 'The end must come after the start', code: 'INVALID_WINDOW' },
      { status: 400 },
    );
  }

  // `slug` is UNIQUE. Suffix on collision rather than letting the insert fail
  // with a constraint error the fundraiser cannot act on.
  const base = givingDaySlug(title);
  let slug = base;
  for (let attempt = 1; attempt <= 20; attempt++) {
    const { data: taken } = await supabaseAdmin
      .from('giving_days')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${attempt + 1}`;
  }

  const { data, error } = await supabaseAdmin
    .from('giving_days')
    .insert({
      title,
      slug,
      nonprofit_id: nonprofitId,
      starts_at: startsAt,
      ends_at: endsAt,
      goal_amount: goalAmountCents ?? null,
    })
    .select('id, slug')
    .single();

  if (error) {
    console.warn('[giving-days] insert failed', { code: error.code });
    return NextResponse.json({ error: 'Could not save', code: 'WRITE_FAILED' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, id: data.id, slug: data.slug, policy: POLICY_MIRRORED });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const actor = await actorFor(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = DeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'id required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  // Read the row FIRST so the ownership check runs against its real
  // nonprofit_id. Deleting by id alone would let anyone who can guess a uuid
  // remove another organisation's event.
  const { data: row, error: readError } = await supabaseAdmin
    .from('giving_days')
    .select('id, nonprofit_id')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: 'Unavailable', code: 'READ_FAILED' }, { status: 503 });
  if (!row) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  if (!canManageGivingDay(actor, { nonprofit_id: row.nonprofit_id as string | null })) {
    // 404, not 403: telling a stranger that this id exists is itself a leak.
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from('giving_days').delete().eq('id', row.id);
  if (error) return NextResponse.json({ error: 'Could not delete', code: 'WRITE_FAILED' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
