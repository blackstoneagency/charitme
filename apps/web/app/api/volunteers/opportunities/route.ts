import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isAdmin } from '../../../../lib/roles';
import { OPPORTUNITY_PUBLIC_COLUMNS, OpportunitySearchSchema } from '../../../../lib/volunteers';

export const dynamic = 'force-dynamic';

// GET /api/volunteers/opportunities — public discovery.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = OpportunitySearchSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }
  const { q, category, skill, remote, status, limit, offset } = parsed.data;

  let query = supabaseAdmin
    .from('volunteer_opportunities')
    .select(OPPORTUNITY_PUBLIC_COLUMNS, { count: 'exact' })
    .is('deleted_at', null);

  query = status ? query.eq('status', status) : query.in('status', ['open', 'upcoming']);
  if (category) query = query.eq('category', category);
  if (skill) query = query.contains('skills', [skill]);
  if (remote === 'true') query = query.eq('is_remote', true);
  if (remote === 'false') query = query.eq('is_remote', false);
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ').trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,org_name.ilike.%${safe}%,summary.ilike.%${safe}%`);
  }

  query = query
    .order('verified', { ascending: false })
    .order('starts_at', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunities: data ?? [], total: count ?? 0, limit, offset });
}

const CreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  orgName: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(20_000).optional(),
  category: z.string().trim().max(80).optional(),
  skills: z.array(z.string().trim().max(80)).max(40).optional(),
  location: z.string().trim().max(200).optional(),
  country: z.string().trim().max(80).optional(),
  isRemote: z.boolean().default(false),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  slots: z.number().int().nonnegative().optional(),
  timeCommitment: z.string().trim().max(120).optional(),
  contactUrl: z.string().url().max(500).optional(),
  status: z.enum(['open', 'upcoming', 'closed']).default('open'),
});

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

// POST /api/volunteers/opportunities — create (admin only for now).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id, user.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const o = parsed.data;
  const slug = `${slugify(o.title) || 'opportunity'}-${Math.random().toString(36).slice(2, 7)}`;

  const { data, error } = await supabaseAdmin
    .from('volunteer_opportunities')
    .insert({
      slug,
      title: o.title,
      org_name: o.orgName,
      summary: o.summary ?? null,
      description: o.description ?? null,
      category: o.category ?? null,
      skills: o.skills ?? [],
      location: o.location ?? null,
      country: o.country ?? null,
      is_remote: o.isRemote,
      starts_at: o.startsAt ?? null,
      ends_at: o.endsAt ?? null,
      slots: o.slots ?? null,
      time_commitment: o.timeCommitment ?? null,
      contact_url: o.contactUrl ?? null,
      status: o.status,
      created_by: user.id,
    })
    .select('id, slug')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunity: data }, { status: 201 });
}
