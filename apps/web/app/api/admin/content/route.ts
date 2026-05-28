import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';

// GET /api/admin/content?limit=100
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);

  const { data, error } = await supabaseAdmin
    .from('campaign_updates')
    .select('id, title, body, ai_generated, campaign_id, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/admin/content
// Body: { title?, body, campaignId, aiGenerated? }
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    title?: string;
    body?: string;
    campaignId?: string;
    aiGenerated?: boolean;
  } | null;

  if (!body?.body?.trim()) {
    return NextResponse.json({ error: 'Content body is required.' }, { status: 400 });
  }
  if (!body.campaignId?.trim()) {
    return NextResponse.json({ error: 'Campaign ID is required.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('campaign_updates')
    .insert({
      campaign_id: body.campaignId.trim(),
      title: body.title?.trim() || null,
      body: body.body.trim(),
      ai_generated: Boolean(body.aiGenerated),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id, title, body, ai_generated, campaign_id, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write audit log
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: admin.id,
      action: 'content.created',
      target_type: 'campaign_update',
      target_id: (data as { id: string }).id,
      metadata: { campaign_id: body.campaignId, title: body.title },
      created_at: new Date().toISOString(),
    });
  } catch { /* ignore audit failures */ }

  return NextResponse.json({ ok: true, update: data }, { status: 201 });
}
