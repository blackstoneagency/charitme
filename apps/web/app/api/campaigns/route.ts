import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';

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
  description: z.string().min(20),
  goalAmount: z.number().int().min(100),
  deadline: z.string().nullable().optional(),
  category: z.string(),
  coverImageUrl: z.string().url().nullable().optional(),
  beneficiaryName: z.string().max(120).optional(),
  beneficiaryRelationship: z.string().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { title, tagline, description, goalAmount, deadline, category, coverImageUrl, beneficiaryName, beneficiaryRelationship } = parsed.data;

  const baseSlug = slugify(title);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .insert({
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
      status: 'active',
    })
    .select('id, slug')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const q = searchParams.get('q');

  let query = supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status')
    .eq('status', 'active')
    .order('raised_amount', { ascending: false })
    .limit(50);

  if (category) query = query.eq('category', category);
  if (q) query = query.ilike('title', `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
