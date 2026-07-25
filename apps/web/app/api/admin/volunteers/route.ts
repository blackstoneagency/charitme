import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

export const dynamic = 'force-dynamic';

const ADMIN_COLUMNS =
  'id,slug,title,org_name,summary,description,category,skills,location,country,is_remote,' +
  'starts_at,ends_at,slots,slots_filled,time_commitment,contact_url,status,verified,created_at,updated_at';

// GET /api/admin/volunteers — every non-deleted opportunity, all statuses (admin only).
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('volunteer_opportunities')
    .select(ADMIN_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ opportunities: data ?? [] });
}

const OpportunityWriteSchema = z.object({
  title: z.string().trim().min(3).max(200),
  orgName: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(1000).optional().nullable(),
  description: z.string().trim().max(20_000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  skills: z.array(z.string().trim().max(80)).max(40).optional(),
  location: z.string().trim().max(200).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  isRemote: z.boolean().default(false),
  startsAt: z.string().datetime().optional().nullable().or(z.literal('')),
  endsAt: z.string().datetime().optional().nullable().or(z.literal('')),
  slots: z.number().int().nonnegative().max(100_000).optional().nullable(),
  timeCommitment: z.string().trim().max(120).optional().nullable(),
  contactUrl: z.string().url().max(500).optional().nullable().or(z.literal('')),
  status: z.enum(['open', 'upcoming', 'closed']).default('open'),
  verified: z.boolean().default(false),
});

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

// POST /api/admin/volunteers — publish a volunteer opportunity (admin only).
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = OpportunityWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const o = parsed.data;
  if (o.startsAt && o.endsAt && new Date(o.startsAt) > new Date(o.endsAt)) {
    return NextResponse.json({ error: 'Start date cannot be after end date' }, { status: 400 });
  }

  const slug = `${slugify(o.title) || 'opportunity'}-${Math.random().toString(36).slice(2, 7)}`;

  const { data, error } = await supabaseAdmin
    .from('volunteer_opportunities')
    .insert({
      slug,
      title: o.title,
      org_name: o.orgName,
      summary: o.summary || null,
      description: o.description || null,
      category: o.category || null,
      skills: o.skills ?? [],
      location: o.location || null,
      country: o.country || null,
      is_remote: o.isRemote,
      starts_at: o.startsAt || null,
      ends_at: o.endsAt || null,
      slots: o.slots ?? null,
      time_commitment: o.timeCommitment || null,
      contact_url: o.contactUrl || null,
      status: o.status,
      verified: o.verified,
      created_by: admin.id,
    })
    .select(ADMIN_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ opportunity: data }, { status: 201 });
}
