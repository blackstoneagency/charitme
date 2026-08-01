import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';

export const dynamic = 'force-dynamic';

const SELECT =
  'id, name, category, subject, preview_text, body, variables, is_system, created_by, created_at, updated_at';

const TemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(40).default('general'),
  subject: z.string().max(200).default(''),
  previewText: z.string().max(200).nullable().optional(),
  body: z.string().max(50_000).default(''),
  variables: z.array(z.string().max(40)).max(30).optional(),
});

// ── GET /api/admin/marketing/templates ──────────────────────────────────────
// Email templates (design #146). `marketing_email_templates` has been in the
// schema since 20260610010000 and was reachable only from the automations route,
// which reads a template by name — there has never been a way to see what
// templates exist, let alone edit one.
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('marketing_email_templates')
    .select(SELECT)
    .order('category', { ascending: true })
    .order('name', { ascending: true })
    .limit(500);

  // A failed read must not render as "no templates" — an admin would recreate
  // templates that already exist, and the automations that reference them by
  // name would then have duplicates to choose between.
  if (error) {
    return NextResponse.json(
      { error: 'Could not load templates', code: 'TEMPLATES_UNAVAILABLE' },
      { status: 503 },
    );
  }
  return NextResponse.json({ templates: data ?? [] });
}

// ── POST /api/admin/marketing/templates ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = TemplateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid template', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const t = parsed.data;

  const { data, error } = await supabaseAdmin
    .from('marketing_email_templates')
    .insert({
      name: t.name,
      category: t.category,
      subject: t.subject,
      preview_text: t.previewText ?? null,
      body: t.body,
      ...(t.variables ? { variables: t.variables } : {}),
      // Only the seeded templates are `is_system`. Anything created here is
      // editable and deletable, so it must never claim to be one.
      is_system: false,
      created_by: admin.id,
    })
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not create the template', code: 'CREATE_FAILED' }, { status: 500 });
  }

  const { error: auditErr } = await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id,
    action: 'template_created',
    // `entity` / `detail`, not `entity_type` / `metadata`. Checked against the
    // schema rather than assumed: `entity` is NOT NULL, so the invented names
    // would have made every one of these inserts fail.
    entity: 'marketing_email_templates',
    entity_id: data.id,
    detail: { name: t.name, category: t.category },
  });
  if (auditErr) {
    console.error('[admin/marketing/templates] audit insert failed', {
      template_id: data.id,
      message: auditErr.message,
    });
  }

  return NextResponse.json({ template: data }, { status: 201 });
}
