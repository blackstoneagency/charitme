import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';
import { findCategory } from '../../../../lib/retention';

export const dynamic = 'force-dynamic';

const UpsertSchema = z.object({
  category: z.string().min(1).max(60),
  retentionDays: z.number().int().min(1).max(3650),
  autoDelete: z.boolean().default(false),
});

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('data_retention_policies')
    .select('id, category, retention_days, auto_delete, updated_at')
    .order('category', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: 'Could not load retention policies', code: 'POLICIES_UNAVAILABLE' },
      { status: 503 },
    );
  }
  return NextResponse.json({ policies: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = UpsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid policy', code: 'INVALID_INPUT' }, { status: 400 });
  }
  const p = parsed.data;

  // The allowlist in lib/retention.ts is what bounds which tables the retention
  // job may ever delete from. Accepting an arbitrary category string here would
  // route around it — the admin form would become the allowlist.
  if (!findCategory(p.category)) {
    return NextResponse.json(
      { error: 'Unknown data category.', code: 'UNKNOWN_CATEGORY' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('data_retention_policies')
    .upsert(
      {
        category: p.category,
        retention_days: p.retentionDays,
        auto_delete: p.autoDelete,
        updated_by: admin.id,
      },
      // `category` is UNIQUE (20260822000000), so this target is inferable — a
      // partial or missing index here is what made four other upserts fail
      // 42P10 (see 20260812000000).
      { onConflict: 'category' },
    )
    .select('id, category, retention_days, auto_delete, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not save the policy', code: 'SAVE_FAILED' }, { status: 500 });
  }

  const { error: auditErr } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'retention.policy_updated',
    target_type: 'data_retention_policy',
    target_id: data.id,
    metadata: { category: p.category, retention_days: p.retentionDays, auto_delete: p.autoDelete },
  });
  if (auditErr) {
    console.error('[admin/retention] audit insert failed', { category: p.category, message: auditErr.message });
  }

  return NextResponse.json({ policy: data });
}
