import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import { isSuppressed } from '../../../../../lib/marketing-engine';
import { sendMarketingEmail } from '../../../../../lib/email';

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [autosRes, runsRes] = await Promise.all([
    supabaseAdmin.from('marketing_automations').select('*').order('created_at', { ascending: true }),
    supabaseAdmin.from('marketing_automation_runs').select('*, marketing_automations(name)').order('created_at', { ascending: false }).limit(50),
  ]);
  return NextResponse.json({ automations: autosRes.data ?? [], runs: runsRes.data ?? [] });
}

const ToggleSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['enable', 'disable', 'run']),
});

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  const { id, action } = parsed.data;

  if (action !== 'run') {
    await supabaseAdmin.from('marketing_automations').update({ enabled: action === 'enable' }).eq('id', id);
    await supabaseAdmin.from('marketing_audit_logs').insert({
      actor_id: admin.id, action: `automation_${action}d`, entity: 'marketing_automations', entity_id: id,
    });
    return NextResponse.json({ ok: true, enabled: action === 'enable' });
  }

  // ── Manual run: find matching contacts for the trigger and execute the action ──
  const { data: automation } = await supabaseAdmin.from('marketing_automations').select('*').eq('id', id).single();
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const matched = await findTriggerMatches(automation.trigger_event, automation.trigger_config as Record<string, unknown>);
  let executed = 0;
  let skipped = 0;

  for (const contact of matched.slice(0, 100)) {
    if (automation.action_type === 'send_email') {
      if (!contact.email || await isSuppressed(contact.email)) { skipped++; continue; }
      const cfg = automation.action_config as { template_category?: string };
      const { data: template } = await supabaseAdmin
        .from('marketing_email_templates')
        .select('subject, preview_text, body')
        .eq('category', cfg.template_category ?? 'general')
        .limit(1)
        .maybeSingle();
      if (!template) { skipped++; continue; }
      const fn = contact.first_name || 'friend';
      const result = await sendMarketingEmail({
        to: contact.email,
        subject: template.subject.replaceAll('{{first_name}}', fn),
        text: template.body
          .replaceAll('{{first_name}}', fn)
          .replaceAll('{{browse_url}}', 'https://www.charitme.com/campaigns')
          .replaceAll('{{campaign_title}}', 'your campaign')
          .replaceAll('{{campaign_url}}', 'https://www.charitme.com/campaigns')
          .replaceAll('{{update_url}}', 'https://www.charitme.com/dashboard/updates')
          .replaceAll('{{payout_url}}', 'https://www.charitme.com/dashboard/payouts')
          .replaceAll('{{preferred_cause}}', 'community'),
        previewText: template.preview_text,
      });
      await supabaseAdmin.from('marketing_automation_runs').insert({
        automation_id: id, contact_id: contact.id,
        status: result.sent ? 'success' : 'failed',
        detail: result.sent ? 'email sent' : 'email provider not configured',
      });
      if (result.sent) executed++; else skipped++;
    } else {
      // Non-email actions: record the run; segments/tasks rails exist for future wiring
      await supabaseAdmin.from('marketing_automation_runs').insert({
        automation_id: id, contact_id: contact.id, status: 'skipped',
        detail: `action ${automation.action_type} requires manual handling`,
      });
      skipped++;
    }
  }

  await supabaseAdmin.from('marketing_automations').update({
    run_count: (automation.run_count ?? 0) + executed,
    last_run_at: new Date().toISOString(),
  }).eq('id', id);

  return NextResponse.json({ ok: true, matched: matched.length, executed, skipped });
}

type MatchedContact = { id: string; email: string | null; first_name: string | null };

async function findTriggerMatches(trigger: string, config: Record<string, unknown>): Promise<MatchedContact[]> {
  const base = supabaseAdmin.from('marketing_contacts').select('id, email, first_name').eq('status', 'active');

  if (trigger === 'donor_inactive') {
    const days = Number(config.inactive_days ?? 60);
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data } = await base.gte('donation_count', 1).lt('last_active_at', cutoff).limit(500);
    return data ?? [];
  }
  if (trigger === 'donation_abandoned') {
    // Contacts with a donation_started event but no donation_completed
    const { data: started } = await supabaseAdmin
      .from('marketing_events').select('contact_id').eq('event_type', 'donation_started').not('contact_id', 'is', null);
    const { data: completed } = await supabaseAdmin
      .from('marketing_events').select('contact_id').eq('event_type', 'donation_completed').not('contact_id', 'is', null);
    const done = new Set((completed ?? []).map(e => e.contact_id));
    const ids = [...new Set((started ?? []).map(e => e.contact_id).filter(cid => cid && !done.has(cid)))] as string[];
    if (ids.length === 0) return [];
    const { data } = await base.in('id', ids.slice(0, 500));
    return data ?? [];
  }
  if (trigger === 'donation_completed') {
    const min = Number((config as { min_donations?: number }).min_donations ?? 1);
    const { data } = await base.gte('donation_count', min).limit(500);
    return data ?? [];
  }
  if (trigger === 'payout_setup_incomplete') {
    const { data } = await base.eq('client_type', 'beneficiary').limit(500);
    return data ?? [];
  }
  if (trigger === 'no_update_posted') {
    const { data } = await base.in('client_type', ['organizer', 'draft_organizer']).limit(500);
    return data ?? [];
  }
  return [];
}
