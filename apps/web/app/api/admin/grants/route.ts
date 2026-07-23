import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

export const dynamic = 'force-dynamic';

const ADMIN_COLUMNS =
  'id,slug,title,funder_name,funder_type,summary,description,category,focus_areas,eligibility,' +
  'eligible_entity_types,amount_min,amount_max,currency,location,country,application_url,' +
  'deadline_at,rolling_deadline,status,verified,source,created_at,updated_at';

// GET /api/admin/grants — every non-deleted grant, all statuses (admin only).
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('grants')
    .select(ADMIN_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ grants: data ?? [] });
}

const GrantWriteSchema = z.object({
  title: z.string().trim().min(3).max(200),
  funderName: z.string().trim().min(2).max(200),
  funderType: z.enum(['foundation', 'government', 'corporate', 'community', 'individual', 'other']).default('foundation'),
  summary: z.string().trim().max(1000).optional().nullable(),
  description: z.string().trim().max(20_000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  focusAreas: z.array(z.string().trim().max(80)).max(25).optional(),
  eligibility: z.string().trim().max(5000).optional().nullable(),
  eligibleEntityTypes: z.array(z.string().trim().max(80)).max(25).optional(),
  amountMin: z.number().int().nonnegative().nullable().optional(),
  amountMax: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).default('USD'),
  location: z.string().trim().max(200).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  applicationUrl: z.string().url().max(500).optional().nullable().or(z.literal('')),
  deadlineAt: z.string().datetime().optional().nullable().or(z.literal('')),
  rollingDeadline: z.boolean().default(false),
  status: z.enum(['open', 'upcoming', 'closed']).default('open'),
  verified: z.boolean().default(false),
});

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

// POST /api/admin/grants — create a grant (admin only).
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = GrantWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const g = parsed.data;
  if (g.amountMin != null && g.amountMax != null && g.amountMin > g.amountMax) {
    return NextResponse.json({ error: 'Minimum award cannot exceed maximum' }, { status: 400 });
  }

  const slug = `${slugify(g.title) || 'grant'}-${Math.random().toString(36).slice(2, 7)}`;

  const { data, error } = await supabaseAdmin
    .from('grants')
    .insert({
      slug,
      title: g.title,
      funder_name: g.funderName,
      funder_type: g.funderType,
      summary: g.summary || null,
      description: g.description || null,
      category: g.category || null,
      focus_areas: g.focusAreas ?? [],
      eligibility: g.eligibility || null,
      eligible_entity_types: g.eligibleEntityTypes ?? [],
      amount_min: g.amountMin ?? null,
      amount_max: g.amountMax ?? null,
      currency: g.currency,
      location: g.location || null,
      country: g.country || null,
      application_url: g.applicationUrl || null,
      deadline_at: g.deadlineAt || null,
      rolling_deadline: g.rollingDeadline,
      status: g.status,
      verified: g.verified,
      source: 'admin',
      created_by: admin.id,
    })
    .select(ADMIN_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ grant: data }, { status: 201 });
}
