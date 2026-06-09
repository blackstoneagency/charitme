import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdmin } from '../../users/_auth';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { openai, OPENAI_MODEL } from '../../../../../lib/openai';

const Schema = z.object({
  task: z.enum(['campaign_copy', 'subject_lines', 'sms_copy', 'social_post', 'weekly_plan', 'analyze']),
  context: z.string().max(4000).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!openai) {
    return NextResponse.json({
      error: 'AI provider not configured. Set OPENAI_API_KEY to enable the Marketing Copilot.',
      configured: false,
    }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { task, context } = parsed.data;

  // Ground the copilot in live platform stats
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [contactsRes, eventsRes, campaignsRes] = await Promise.all([
    supabaseAdmin.from('marketing_contacts').select('client_type, lifecycle_stage', { count: 'exact', head: false }).limit(1000),
    supabaseAdmin.from('marketing_events').select('event_type').gte('created_at', weekAgo).limit(2000),
    supabaseAdmin.from('marketing_campaigns').select('name, status, sent_count, open_count, click_count').order('created_at', { ascending: false }).limit(10),
  ]);

  const typeCounts: Record<string, number> = {};
  for (const c of contactsRes.data ?? []) typeCounts[c.client_type] = (typeCounts[c.client_type] ?? 0) + 1;
  const eventCounts: Record<string, number> = {};
  for (const e of eventsRes.data ?? []) eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1;

  const stats = `Contacts by type: ${JSON.stringify(typeCounts)}. Events last 7 days: ${JSON.stringify(eventCounts)}. Recent campaigns: ${JSON.stringify(campaignsRes.data ?? [])}.`;

  const prompts: Record<typeof task, string> = {
    campaign_copy: 'Write a complete marketing email (subject + body, plain text, {{first_name}} variable) for the goal described. Warm, trustworthy, no manipulation.',
    subject_lines: 'Write 8 email subject lines for the goal described. Mix curiosity, urgency (ethical), and warmth. One per line.',
    sms_copy: 'Write 3 SMS variants (max 160 chars each, include a short CTA) for the goal described.',
    social_post: 'Write 3 social posts (X, Facebook, LinkedIn tone respectively) for the goal described. Include suggested hashtags.',
    weekly_plan: 'Create a 7-day marketing plan for CharitMe based on the live stats. Day-by-day actions, audiences, and channels. Be specific and realistic.',
    analyze: 'Analyze the live marketing stats. Identify the biggest dropoff, the most promising segment, and the top 3 recommended actions this week.',
  };

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: `You are CharitMe's Marketing Copilot, an expert fundraising-platform growth marketer. Live platform stats: ${stats}` },
      { role: 'user', content: `${prompts[task]}\n\n${context ? `Goal/context: ${context}` : 'No additional context — use the live stats.'}` },
    ],
  });

  const result = completion.choices[0]?.message?.content ?? '';
  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'copilot_used', entity: 'marketing_copilot', detail: { task },
  });
  return NextResponse.json({ result, configured: true });
}
