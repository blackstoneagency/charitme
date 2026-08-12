import { boundedQuery } from '../../../../lib/query-timeout';
import 'server-only';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { supabaseAdmin } from '../../../../lib/supabase';
import TemplatesClient, { type EmailTemplate } from './TemplatesClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Email Templates | CharitMe Admin' };

// ─────────────────────────────────────────────────────────────────────────────
// Email Templates (design #146).
//
// `marketing_email_templates` has been in the schema since 20260610010000 and
// the only code that touched it was the automations runner, which picks a
// template by category and sends it. Nothing could list the templates, see what
// an automation would actually send, or edit the copy — so the table was
// effectively write-once-by-migration.
//
// ⚠️ Worth knowing when editing: the automations route resolves a template with
//   .eq('category', …).limit(1).maybeSingle()
// — no ordering. With two templates in one category, which one gets sent is
// whatever Postgres returns first, and it can differ between calls. The API
// refuses to move a built-in template out of its category for that reason, but
// the ambiguity itself is a schema-level issue logged in todo.md.
//
// Admin gating is inherited from app/admin/layout.tsx, and the API routes call
// verifyAdmin independently — the page being behind a layout is not access
// control, since the routes are reachable directly.
// ─────────────────────────────────────────────────────────────────────────────

export default async function EmailTemplatesPage() {
  const { data, error } = await boundedQuery(() => supabaseAdmin
    .from('marketing_email_templates')
    .select(
      'id, name, category, subject, preview_text, body, variables, is_system, created_by, created_at, updated_at',
    )
    .order('category', { ascending: true })
    .order('name', { ascending: true })
    .limit(500));

  // null means the read FAILED. Rendering the empty state instead would invite
  // an admin to recreate templates that already exist — and since automations
  // select by category, a duplicate changes what gets sent.
  const templates: EmailTemplate[] | null = error ? null : ((data ?? []) as EmailTemplate[]);

  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar
        title="Email Templates"
        subtitle="The copy your marketing automations send. Automations select a template by category."
      />
      <TemplatesClient initialTemplates={templates} />
    </CharitMeShell>
  );
}
