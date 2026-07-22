import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { checkRateLimit } from '../../../lib/rate-limit';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

const CreateSchema = z.object({
  title: z.string().min(3).max(100),
  tagline: z.string().max(160).optional(),
  description: z.string().min(1),    // allow short description for drafts
  goalAmount: z.number().int().min(1),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  category: z.enum(CAMPAIGN_CATEGORIES),
  coverImageUrl: z.string().url().nullable().optional(),
  imageUrls: z.array(z.string().url()).max(10).optional(),
  beneficiaryName: z.string().max(120).optional(),
  beneficiaryRelationship: z.string().max(120).optional(),
  evidenceNote: z.string().max(1000).optional(),
  location: z.string().max(120).optional(),
  videoUrl: z.string().url().nullable().optional(),
  // 'draft' saves without publishing; 'active' publishes immediately (default)
  status: z.enum(['draft', 'active']).default('active'),
}).superRefine((value, ctx) => {
  if (value.status === 'active' && value.description.trim().length < 20) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['description'], message: 'Active campaigns need a story of at least 20 characters.' });
  }
  if (value.status === 'active' && value.goalAmount < 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['goalAmount'], message: 'Active campaigns need a goal of at least 100 cents.' });
  }
});

export async function POST(request: NextRequest) {
  // 5 campaign creations per user per hour — prevents abuse
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`campaign:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid campaign input', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });

  const { title, tagline, description, goalAmount, deadline, category, coverImageUrl, imageUrls, beneficiaryName, beneficiaryRelationship, evidenceNote, location, videoUrl, status } = parsed.data;

  const baseSlug = slugify(title);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const baseInsert = {
    user_id: user.id,
    slug,
    title,
    tagline: tagline ?? null,
    description,
    goal_amount: goalAmount,
    raised_amount: 0,
    backer_count: 0,
    deadline: deadline ?? null,
    category,
    cover_image_url: coverImageUrl ?? null,
    beneficiary_name: beneficiaryName ?? null,
    beneficiary_relationship: beneficiaryRelationship ?? null,
    location: location ?? null,
    video_url: videoUrl ?? null,
    status: status ?? 'active',
    accept_donations: status === 'active',
    visibility: status === 'active' ? 'public' : 'private',
  };

  // Try inserting with image_urls; fall back gracefully if column doesn't exist yet
  // PostgREST schema-cache miss = PGRST204; PostgreSQL undefined_column = 42703
  const isImageUrlsError = (err: { code?: string; message?: string } | null) =>
    err != null &&
    (err.code === 'PGRST204' || err.code === '42703') &&
    (err.message ?? '').includes('image_urls');

  let result = await supabaseAdmin
    .from('campaigns')
    .insert({ ...baseInsert, image_urls: imageUrls ?? [] } as typeof baseInsert)
    .select('id, slug')
    .single();

  if (isImageUrlsError(result.error)) {
    // Column not yet migrated — insert without it
    result = await supabaseAdmin
      .from('campaigns')
      .insert(baseInsert)
      .select('id, slug')
      .single();
  }

  const { data, error } = result;

  if (error) {
    console.error('Campaign create failed', error.code, error.message);
    return NextResponse.json(
      { error: 'Campaign could not be saved.', code: 'CAMPAIGN_CREATE_FAILED' },
      { status: 500 },
    );
  }

  if (evidenceNote?.trim()) {
    const { error: ledgerError } = await supabaseAdmin
      .from('transparency_ledger_items')
      .insert({
        campaign_id: data.id,
        item_type: 'milestone',
        title: 'Organizer evidence note',
        description: evidenceNote.trim(),
        category: 'Trust',
        status: 'published',
      });

    if (ledgerError) {
      console.error('Campaign evidence save failed', ledgerError);
      return NextResponse.json({ error: 'Campaign created, but evidence note could not be saved.', code: 'EVIDENCE_SAVE_FAILED', slug: data.slug }, { status: 500 });
    }
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const q = searchParams.get('q');

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '24', 10)));
  const offset = (page - 1) * limit;
  const location = searchParams.get('location');
  const visibility = searchParams.get('visibility') ?? 'public';
  const sort = searchParams.get('sort') ?? 'raised';
  const sortCol = sort === 'newest' ? 'created_at' : sort === 'backers' ? 'backer_count' : 'raised_amount';

  let query = supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, location, accept_donations', { count: 'exact' })
    .eq('status', 'active')
    .eq('visibility', visibility)
    .is('deleted_at', null)
    .order(sortCol, { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);
  if (location) query = query.ilike('location', `%${location}%`);
  // Full-text search on title using trigram index — ilike takes advantage of gin_trgm_ops
  if (q) query = query.ilike('title', `%${q}%`);

  const { data, error } = await query;
  if (error) {
    console.error('Campaign list failed', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }

  const { data: countResult } = await supabaseAdmin
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('visibility', visibility)
    .is('deleted_at', null);
  void countResult;

  return NextResponse.json({ campaigns: data ?? [], page, limit });
}
