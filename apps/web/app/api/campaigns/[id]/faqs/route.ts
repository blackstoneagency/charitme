import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { canManageCampaign } from '../../../../../lib/auth';
import { openai, OPENAI_MODEL } from '../../../../../lib/openai';

const Schema = z.object({
  question: z.string().trim().min(5).max(300),
  answer:   z.string().trim().min(5).max(2000),
  sortOrder: z.number().int().min(0).optional(),
  isPublic:  z.boolean().default(true),
});

// GET /api/campaigns/[id]/faqs — public read; owners/admins also see private FAQs
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Owners and admins see private FAQs too
  let includePrivate = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: campaign } = await supabaseAdmin
        .from('campaigns')
        .select('id, user_id')
        .eq('id', id)
        .single();
      if (campaign && (await canManageCampaign(user, campaign.user_id))) includePrivate = true;
    }
  } catch { /* fall back to public-only */ }

  let query = supabaseAdmin
    .from('campaign_faqs')
    .select('id, question, answer, sort_order, is_public, created_at')
    .eq('campaign_id', id)
    .order('sort_order', { ascending: true });
  if (!includePrivate) query = query.eq('is_public', true);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ faqs: data ?? [] });
}

// POST /api/campaigns/[id]/faqs — create or AI-generate
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: campaignId } = await params;

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, description, category, user_id')
    .eq('id', campaignId)
    .single();
  if (!campaign || !(await canManageCampaign(user, campaign.user_id))) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // AI generation mode
  const b = body as Record<string, unknown>;
  if (b.generateAI === true) {
    const faqs = await generateFAQs(campaign.title, campaign.description ?? '', campaign.category ?? '');
    // Insert all generated FAQs
    const rows = faqs.map((f, i) => ({
      campaign_id: campaignId,
      question:    f.question,
      answer:      f.answer,
      sort_order:  i,
      is_public:   true,
    }));

    const { data: inserted, error } = await supabaseAdmin
      .from('campaign_faqs')
      .insert(rows)
      .select('id, question, answer, sort_order');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ faqs: inserted, generated: true }, { status: 201 });
  }

  // Manual create
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { question, answer, sortOrder, isPublic } = parsed.data;
  const { data: faq, error } = await supabaseAdmin
    .from('campaign_faqs')
    .insert({ campaign_id: campaignId, question, answer, sort_order: sortOrder ?? 0, is_public: isPublic })
    .select('id, question, answer, sort_order, is_public')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ faq }, { status: 201 });
}

async function generateFAQs(title: string, description: string, category: string): Promise<{ question: string; answer: string }[]> {
  const defaults = [
    { question: 'How will the funds be used?', answer: 'All funds raised will be used directly for the purpose described in this campaign. We will post regular updates showing how funds are being spent.' },
    { question: 'Who receives the donations?', answer: 'Funds go directly to the campaign organizer or designated beneficiary via Stripe Connect secure bank transfer.' },
    { question: 'Will I get updates on progress?', answer: 'Yes! We commit to regular updates as milestones are reached. You can follow this campaign for notifications.' },
    { question: 'Is my donation tax-deductible?', answer: 'Donations are not tax-deductible unless this campaign is run by a verified 501(c)(3) nonprofit organization.' },
    { question: 'What happens if the goal is not reached?', answer: 'This is a flexible funding campaign — all donations are processed and delivered to the organizer regardless of whether the goal is met.' },
  ];

  if (!openai) return defaults;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 800,
      messages: [
        { role: 'system', content: 'Generate 5 donor FAQ pairs for a fundraising campaign. Return JSON array of {question, answer} objects. Answers should be honest, reassuring, and specific to the campaign. Max 150 words per answer.' },
        { role: 'user', content: `Campaign: "${title}"\nCategory: ${category}\nDescription: ${description.slice(0, 500)}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    const clean = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(clean) as { question: string; answer: string }[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 8);
  } catch { /* fall through */ }

  return defaults;
}
