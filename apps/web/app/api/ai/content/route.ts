import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { canManageCampaign } from '../../../../lib/auth';

const Schema = z.object({
  type: z.enum(['facebook', 'twitter', 'instagram', 'linkedin', 'whatsapp', 'sms', 'email', 'update']),
  campaignId: z.string().uuid(),
  context: z.string().max(500).optional(), // extra context from user
});

// POST /api/ai/content
// Generates platform-specific social posts, email campaigns, or donor updates
// for the authenticated organiser's campaign.
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  if (!checkRateLimit(`ai-content:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 });
  }

  const { type, campaignId, context } = parsed.data;

  // Verify ownership (campaign owner or platform admin)
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id, title, tagline, description, category, goal_amount, raised_amount, backer_count, slug')
    .eq('id', campaignId)
    .single();

  if (!campaign || !(await canManageCampaign(user, campaign.user_id))) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const campaignUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com'}/campaigns/${campaign.slug}`;
  const pct = campaign.goal_amount > 0
    ? Math.round((campaign.raised_amount / campaign.goal_amount) * 100)
    : 0;
  const raised = `$${(campaign.raised_amount / 100).toLocaleString()}`;
  const goal = `$${(campaign.goal_amount / 100).toLocaleString()}`;

  const prompts: Record<typeof type, string> = {
    facebook: `Write a compelling Facebook post for this fundraiser. Include an emotional hook, key details, and a clear call-to-action. 150-200 words. Include 2-3 relevant hashtags at the end. Campaign URL: ${campaignUrl}`,
    twitter: `Write 3 alternative tweets for this fundraiser. Each tweet under 260 characters including URL. Include the link and 1-2 hashtags. Format as numbered list.`,
    instagram: `Write an Instagram caption for this fundraiser. 100-150 words, emotional but authentic. End with a line break then 15-20 relevant hashtags. Campaign URL in bio: ${campaignUrl}`,
    linkedin: `Write a professional LinkedIn post for this fundraiser. 200-300 words. Professional tone, explain the need, impact, and how to help. Include URL: ${campaignUrl}`,
    whatsapp: `Write 2 short WhatsApp messages to send to friends and family. Conversational, personal tone. Under 100 words each. Include URL: ${campaignUrl}. Format as Option 1: and Option 2:`,
    sms: `Write 2 SMS messages for this fundraiser. Under 160 characters each including URL. Urgent but not pushy. Include URL: ${campaignUrl}. Format as Option 1: and Option 2:`,
    email: `Write a complete fundraising email. Subject line, personal greeting, compelling 3-paragraph body, specific ask with amount, CTA button text, and PS. Campaign URL: ${campaignUrl}. Format with Subject: [line], then email body.`,
    update: `Write a warm campaign update from the organiser to donors. 150-200 words. Share progress, express gratitude, describe impact so far, and hint at next milestone. Current stats: ${raised} raised (${pct}% of ${goal} goal), ${campaign.backer_count} donors. ${context ?? ''}`,
  };

  const campaignContext = `Campaign: "${campaign.title}"
Category: ${campaign.category}
Tagline: ${campaign.tagline ?? 'none'}
Story excerpt: ${(campaign.description ?? '').slice(0, 300)}
Raised: ${raised} of ${goal} goal (${pct}%)
Donors: ${campaign.backer_count}
${context ? `Additional context: ${context}` : ''}`;

  if (!openai) {
    // Fallback content when OpenAI is not configured
    return NextResponse.json({ content: generateFallback(type, campaign.title, campaignUrl, raised, pct) });
  }

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: 600,
    messages: [
      { role: 'system', content: 'You are a fundraising copywriter. Write authentic, non-manipulative content that inspires genuine giving. Never use manipulative pressure tactics.' },
      { role: 'user', content: `${campaignContext}\n\nTask: ${prompts[type]}` },
    ],
  });

  const content = response.choices[0]?.message?.content ?? generateFallback(type, campaign.title, campaignUrl, raised, pct);

  // Track generation
  try {
    await supabaseAdmin.from('ai_generations').insert({
      user_id: user.id,
      campaign_id: campaignId,
      generation_type: `content_${type}`,
      prompt: { type, context },
      result: { content },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ content });
}

function generateFallback(type: string, title: string, url: string, raised: string, pct: number): string {
  if (type === 'twitter') return `Help us reach our goal! "${title}" has raised ${raised} (${pct}% of goal). Every donation counts. 💚\n${url}\n#Fundraising #CharitMe`;
  if (type === 'sms') return `Option 1: I'm fundraising for "${title}". Would you support us? ${url}\n\nOption 2: We've raised ${raised} so far! Can you help us go further? ${url}`;
  if (type === 'update') return `Thank you so much for your support! We've raised ${raised} together — that's ${pct}% of our goal. Every donation is making a real difference. We'll keep you updated as we continue this journey. Thank you for believing in us. 💚`;
  return `We're raising funds for "${title}" and would love your support. We've raised ${raised} so far. Visit ${url} to donate or share. Thank you! 💚`;
}
