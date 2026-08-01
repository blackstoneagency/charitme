import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { checkRateLimitDurable } from '../../../lib/rate-limit-durable';
import { isSupportedCurrency } from '@shared/currencies';
import {
  canManageDonationForm,
  hasOwner,
  toSlug,
  DEFAULT_AMOUNTS_CENTS,
} from '../../../lib/donation-form-access';

export const dynamic = 'force-dynamic';

const SELECT =
  'id, nonprofit_id, campaign_id, title, slug, default_amounts_cents, recurring_enabled, currencies, embed_enabled, created_at, updated_at';

const CreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  campaignId: z.string().uuid().nullable().optional(),
  nonprofitId: z.string().uuid().nullable().optional(),
  // Amounts are cents, so they must be integers — a float here would reach
  // Stripe as an invalid amount much later, where the cause is unrecoverable.
  defaultAmountsCents: z
    .array(z.number().int().min(100).max(100_000_00))
    .min(1)
    .max(6)
    .optional(),
  recurringEnabled: z.boolean().optional(),
  currencies: z
    .array(z.string().length(3).toLowerCase().refine(isSupportedCurrency, 'Unsupported currency'))
    .min(1)
    .max(10)
    .optional(),
  embedEnabled: z.boolean().optional(),
});

// ── GET /api/donation-forms ─────────────────────────────────────────────────
// Every form the caller may manage. Deliberately NOT "all forms": the table's
// read policy is public (embeds resolve anonymously), so scoping has to happen
// here or the dashboard would list other people's forms.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: campaigns }, { data: nonprofits }] = await Promise.all([
    supabaseAdmin.from('campaigns').select('id').eq('user_id', user.id),
    supabaseAdmin.from('nonprofit_profiles').select('id').eq('owner_id', user.id),
  ]);

  const campaignIds = (campaigns ?? []).map((c) => (c as { id: string }).id);
  const nonprofitIds = (nonprofits ?? []).map((n) => (n as { id: string }).id);
  if (campaignIds.length === 0 && nonprofitIds.length === 0) {
    return NextResponse.json({ forms: [] });
  }

  // `.or()` with an empty `in.()` list is a syntax error in PostgREST, so each
  // side is only included when it actually has ids.
  const clauses: string[] = [];
  if (campaignIds.length) clauses.push(`campaign_id.in.(${campaignIds.join(',')})`);
  if (nonprofitIds.length) clauses.push(`nonprofit_id.in.(${nonprofitIds.join(',')})`);

  const { data, error } = await supabaseAdmin
    .from('donation_forms')
    .select(SELECT)
    .or(clauses.join(','))
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: 'Could not load your donation forms', code: 'FORMS_UNAVAILABLE' },
      { status: 503 },
    );
  }
  return NextResponse.json({ forms: data ?? [] });
}

// ── POST /api/donation-forms ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await checkRateLimitDurable(`donation-form-create:${user.id}`, 30, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many forms created', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid form', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const link = {
    nonprofit_id: input.nonprofitId ?? null,
    campaign_id: input.campaignId ?? null,
  };
  if (!hasOwner(link)) {
    return NextResponse.json(
      { error: 'A form must belong to a campaign or a nonprofit.', code: 'OWNER_REQUIRED' },
      { status: 400 },
    );
  }
  // Checked BEFORE insert: this is the same rule the RLS policy applies, and the
  // service-role client bypasses RLS, so skipping it here would let anyone
  // create a form against someone else's campaign.
  if (!(await canManageDonationForm(user, link))) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }

  const base = toSlug(input.title) || 'donation-form';
  const { data, error } = await supabaseAdmin
    .from('donation_forms')
    .insert({
      ...link,
      title: input.title,
      // Suffixed so two campaigns can both have a "Donate" form. The unique
      // index remains the real guard — this only avoids the common collision.
      slug: `${base}-${Math.random().toString(36).slice(2, 8)}`,
      default_amounts_cents: input.defaultAmountsCents ?? DEFAULT_AMOUNTS_CENTS,
      recurring_enabled: input.recurringEnabled ?? true,
      currencies: input.currencies ?? ['usd'],
      embed_enabled: input.embedEnabled ?? true,
    })
    .select(SELECT)
    .single();

  if (error) {
    // 23505 = unique violation on the slug index.
    const status = (error as { code?: string }).code === '23505' ? 409 : 500;
    return NextResponse.json(
      {
        error: status === 409 ? 'That form URL is already taken.' : 'Could not create the form',
        code: status === 409 ? 'SLUG_TAKEN' : 'CREATE_FAILED',
      },
      { status },
    );
  }

  return NextResponse.json({ form: data }, { status: 201 });
}
