import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length < 3) return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 });

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < 10) return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 });

  const goalAmount = typeof body.goalAmount === 'number' ? Math.max(100, Math.round(body.goalAmount)) : 0;
  if (goalAmount < 100) return NextResponse.json({ error: 'Goal must be at least $1.00' }, { status: 400 });

  const baseSlug = slugify(title);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const insert = {
    user_id: admin.id,
    slug,
    title,
    tagline: typeof body.tagline === 'string' ? body.tagline.trim() : null,
    description,
    category: typeof body.category === 'string' ? body.category : 'Other',
    goal_amount: goalAmount,
    raised_amount: 0,
    backer_count: 0,
    deadline: typeof body.deadline === 'string' && body.deadline ? body.deadline : null,
    status: typeof body.status === 'string' && ['draft', 'active'].includes(body.status) ? body.status : 'draft',
    beneficiary_name: typeof body.beneficiaryName === 'string' ? body.beneficiaryName.trim() || null : null,
    beneficiary_relationship: typeof body.beneficiaryRelationship === 'string' ? body.beneficiaryRelationship.trim() || null : null,
    cover_image_url: typeof body.coverImageUrl === 'string' ? body.coverImageUrl : null,
    trust_status: 'Under Review',
    campaign_health_score: 50,
  };

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .insert(insert)
    .select('id, slug, title, status')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'campaign.created',
    target_type: 'campaign',
    target_id: data.id,
    metadata: { title, status: insert.status },
    created_at: new Date().toISOString(),
  }).then(() => undefined);

  return NextResponse.json({ ok: true, campaign: data }, { status: 201 });
}
