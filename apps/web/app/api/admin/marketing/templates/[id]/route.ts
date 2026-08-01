import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../users/_auth';

export const dynamic = 'force-dynamic';

const SELECT =
  'id, name, category, subject, preview_text, body, variables, is_system, created_by, created_at, updated_at';

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  subject: z.string().max(200).optional(),
  previewText: z.string().max(200).nullable().optional(),
  body: z.string().max(50_000).optional(),
  variables: z.array(z.string().max(40)).max(30).optional(),
});

async function loadTemplate(id: string) {
  const { data, error } = await supabaseAdmin
    .from('marketing_email_templates')
    .select('id, is_system, name, category')
    .eq('id', id)
    .maybeSingle();
  if (error) return { err: NextResponse.json({ error: 'Could not load the template', code: 'TEMPLATE_UNAVAILABLE' }, { status: 503 }) };
  if (!data) return { err: NextResponse.json({ error: 'Template not found' }, { status: 404 }) };
  return { template: data as { id: string; is_system: boolean; name: string; category: string } };
}

// ── PATCH /api/admin/marketing/templates/[id] ───────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const loaded = await loadTemplate(id);
  if (loaded.err) return loaded.err;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid template', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const u = parsed.data;

  // The automations route resolves a template by CATEGORY, not by name or id:
  //
  //   .eq('category', cfg.template_category ?? 'general').limit(1).maybeSingle()
  //
  // So `category` is the field an automation depends on, and moving a built-in
  // template out of its category silently changes what that automation sends.
  // Renaming is harmless and stays allowed — an earlier version of this guard
  // pinned the name instead, which protected the one field nothing reads.
  if (loaded.template.is_system && u.category !== undefined && u.category !== loaded.template.category) {
    return NextResponse.json(
      {
        error:
          'Built-in templates cannot change category — automations select them by category.',
        code: 'SYSTEM_TEMPLATE_CATEGORY',
      },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (u.name !== undefined) patch.name = u.name;
  if (u.category !== undefined) patch.category = u.category;
  if (u.subject !== undefined) patch.subject = u.subject;
  if (u.previewText !== undefined) patch.preview_text = u.previewText;
  if (u.body !== undefined) patch.body = u.body;
  if (u.variables !== undefined) patch.variables = u.variables;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update', code: 'EMPTY_PATCH' }, { status: 400 });
  }
  // `updated_at` is maintained by the marketing_email_templates_touch trigger
  // (20260610010000), so setting it here would fight the database.

  const { data, error } = await supabaseAdmin
    .from('marketing_email_templates')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not save the template', code: 'SAVE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ template: data });
}

// ── DELETE /api/admin/marketing/templates/[id] ──────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const loaded = await loadTemplate(id);
  if (loaded.err) return loaded.err;

  if (loaded.template.is_system) {
    return NextResponse.json(
      { error: 'Built-in templates cannot be deleted.', code: 'SYSTEM_TEMPLATE' },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin.from('marketing_email_templates').delete().eq('id', id);
  if (error) {
    // Reporting success on a failed delete leaves a template the admin believes
    // is gone, still selectable by every automation.
    return NextResponse.json({ error: 'Could not delete the template', code: 'DELETE_FAILED' }, { status: 500 });
  }

  const { error: auditErr } = await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id,
    action: 'template_deleted',
    entity: 'marketing_email_templates',
    entity_id: id,
    detail: { name: loaded.template.name },
  });
  if (auditErr) {
    console.error('[admin/marketing/templates] delete audit insert failed', { id, message: auditErr.message });
  }

  return NextResponse.json({ ok: true });
}
