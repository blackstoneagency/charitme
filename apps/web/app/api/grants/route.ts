import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { isAdmin } from '../../../lib/roles';
import { GRANT_PUBLIC_COLUMNS, GrantSearchSchema } from '../../../lib/grants';

export const dynamic = 'force-dynamic';

// GET /api/grants — public grant discovery with search/filter/pagination.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = GrantSearchSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }
  const { q, category, focus, entityType, status, minAmount, maxAmount, limit, offset } = parsed.data;

  let query = supabaseAdmin
    .from('grants')
    .select(GRANT_PUBLIC_COLUMNS, { count: 'exact' })
    .is('deleted_at', null);

  // Default to browsable (open + upcoming) unless a specific status is requested.
  query = status ? query.eq('status', status) : query.in('status', ['open', 'upcoming']);

  if (category) query = query.eq('category', category);
  if (focus) query = query.contains('focus_areas', [focus]);
  if (entityType) query = query.contains('eligible_entity_types', [entityType]);
  if (typeof minAmount === 'number') query = query.gte('amount_max', minAmount);
  if (typeof maxAmount === 'number') query = query.lte('amount_min', maxAmount);
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ').trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,funder_name.ilike.%${safe}%,summary.ilike.%${safe}%`);
  }

  query = query
    .order('verified', { ascending: false })
    .order('deadline_at', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  return NextResponse.json({ grants: data ?? [], total: count ?? 0, limit, offset });
}

const GrantCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  funderName: z.string().trim().min(2).max(200),
  funderType: z.enum(['foundation', 'government', 'corporate', 'community', 'individual', 'other']).default('foundation'),
  summary: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(20_000).optional(),
  category: z.string().trim().max(80).optional(),
  focusAreas: z.array(z.string().trim().max(80)).max(25).optional(),
  eligibility: z.string().trim().max(5000).optional(),
  eligibleEntityTypes: z.array(z.string().trim().max(80)).max(25).optional(),
  amountMin: z.number().int().nonnegative().optional(),
  amountMax: z.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).default('USD'),
  location: z.string().trim().max(200).optional(),
  country: z.string().trim().max(80).optional(),
  applicationUrl: z.string().url().max(500).optional(),
  deadlineAt: z.string().datetime().optional(),
  rollingDeadline: z.boolean().default(false),
  status: z.enum(['open', 'upcoming', 'closed']).default('open'),
});

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

// POST /api/grants — create a grant. Admins or grant-maker accounts only.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id, user.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = GrantCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const g = parsed.data;
  if (g.amountMin != null && g.amountMax != null && g.amountMin > g.amountMax) {
    return NextResponse.json({ error: 'amountMin cannot exceed amountMax' }, { status: 400 });
  }

  const base = slugify(g.title) || 'grant';
  const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;

  const { data, error } = await supabaseAdmin
    .from('grants')
    .insert({
      slug,
      title: g.title,
      funder_name: g.funderName,
      funder_type: g.funderType,
      summary: g.summary ?? null,
      description: g.description ?? null,
      category: g.category ?? null,
      focus_areas: g.focusAreas ?? [],
      eligibility: g.eligibility ?? null,
      eligible_entity_types: g.eligibleEntityTypes ?? [],
      amount_min: g.amountMin ?? null,
      amount_max: g.amountMax ?? null,
      currency: g.currency,
      location: g.location ?? null,
      country: g.country ?? null,
      application_url: g.applicationUrl ?? null,
      deadline_at: g.deadlineAt ?? null,
      rolling_deadline: g.rollingDeadline,
      status: g.status,
      source: 'manual',
      created_by: user.id,
    })
    .select('id, slug')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ grant: data }, { status: 201 });
}
