import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isSupportedCurrency } from '@shared/currencies';
import { canManageDonationForm, toSlug } from '../../../../lib/donation-form-access';

export const dynamic = 'force-dynamic';

const SELECT =
  'id, nonprofit_id, campaign_id, title, slug, default_amounts_cents, recurring_enabled, currencies, embed_enabled, created_at, updated_at';

const UpdateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  slug: z.string().trim().min(2).max(60).optional(),
  defaultAmountsCents: z.array(z.number().int().min(100).max(100_000_00)).min(1).max(6).optional(),
  recurringEnabled: z.boolean().optional(),
  currencies: z
    .array(z.string().length(3).toLowerCase().refine(isSupportedCurrency, 'Unsupported currency'))
    .min(1)
    .max(10)
    .optional(),
  embedEnabled: z.boolean().optional(),
});

/** Loads the form and authorizes the caller against it. */
async function load(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data, error } = await supabaseAdmin
    .from('donation_forms')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();

  // A failed lookup must not read as "not found" — the caller would create a
  // duplicate form rather than retry.
  if (error) {
    return { err: NextResponse.json({ error: 'Could not load the form', code: 'FORM_UNAVAILABLE' }, { status: 503 }) };
  }
  if (!data) return { err: NextResponse.json({ error: 'Form not found' }, { status: 404 }) };

  const form = data as { nonprofit_id: string | null; campaign_id: string | null };
  if (!(await canManageDonationForm(user, form))) {
    // 404 rather than 403: the read policy on this table is public, but the
    // existence of someone else's form is still not this caller's business.
    return { err: NextResponse.json({ error: 'Form not found' }, { status: 404 }) };
  }
  return { form: data };
}

// ── GET /api/donation-forms/[id] ────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await load(id);
  if (res.err) return res.err;
  return NextResponse.json({ form: res.form });
}

// ── PATCH /api/donation-forms/[id] ──────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await load(id);
  if (res.err) return res.err;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid form', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const u = parsed.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (u.title !== undefined) patch.title = u.title;
  if (u.slug !== undefined) {
    const slug = toSlug(u.slug);
    if (!slug) {
      return NextResponse.json(
        { error: 'That URL contains no usable characters.', code: 'INVALID_SLUG' },
        { status: 400 },
      );
    }
    patch.slug = slug;
  }
  if (u.defaultAmountsCents !== undefined) patch.default_amounts_cents = u.defaultAmountsCents;
  if (u.recurringEnabled !== undefined) patch.recurring_enabled = u.recurringEnabled;
  if (u.currencies !== undefined) patch.currencies = u.currencies;
  if (u.embedEnabled !== undefined) patch.embed_enabled = u.embedEnabled;

  const { data, error } = await supabaseAdmin
    .from('donation_forms')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error) {
    const status = (error as { code?: string }).code === '23505' ? 409 : 500;
    return NextResponse.json(
      {
        error: status === 409 ? 'That form URL is already taken.' : 'Could not save the form',
        code: status === 409 ? 'SLUG_TAKEN' : 'SAVE_FAILED',
      },
      { status },
    );
  }
  return NextResponse.json({ form: data });
}

// ── DELETE /api/donation-forms/[id] ─────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await load(id);
  if (res.err) return res.err;

  const { error } = await supabaseAdmin.from('donation_forms').delete().eq('id', id);
  if (error) {
    // Reporting success on a failed delete would leave a live embed the owner
    // believes they took down.
    return NextResponse.json({ error: 'Could not delete the form', code: 'DELETE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
