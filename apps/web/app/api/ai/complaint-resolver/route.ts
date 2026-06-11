import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/roles';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ caseId: z.string().uuid() });

type Category =
  | 'payout_delay'
  | 'refund_dispute'
  | 'fraud_concern'
  | 'account_access'
  | 'campaign_management'
  | 'technical_bug'
  | 'billing_question'
  | 'general_inquiry';

type SupportCase = {
  id: string;
  subject: string;
  body: string;
  priority: string;
  status: string;
  campaign_id: string | null;
  submitter_id: string | null;
};

const CATEGORY_RULES: { category: Category; keywords: string[] }[] = [
  { category: 'fraud_concern', keywords: ['flagged', 'suspicious', 'fraud', 'inappropriate', 'duplicated by someone', 'scam'] },
  { category: 'refund_dispute', keywords: ['refund', 'duplicate donation', 'charged twice', 'charged instead of one', 'wrong currency', 'overcharge'] },
  { category: 'payout_delay', keywords: ['payout', 'withdraw', 'transfer my', 'bank account', 'received my donation', 'how long does payout'] },
  { category: 'account_access', keywords: ['log in', 'login', 'locked', 'password', 'sso', 'identity verification', 'delete my account', 'legal name'] },
  { category: 'campaign_management', keywords: ['edit my campaign', 'co-organizer', 'co organizer', 'transfer ownership', 'extend my campaign', 'pause my campaign', 'goal amount', 'close my campaign', 'team fundraising', 'verified badge', 'campaign url'] },
  { category: 'billing_question', keywords: ['1099', 'tax form', 'fee waiver', 'charitscore', 'platform fee'] },
  { category: 'technical_bug', keywords: ['not working', 'crash', 'not loading', 'not displaying', 'broken', 'error message', 'not showing', 'spam', 'did not go through', 'cannot donate'] },
];

function categorize(subject: string, body: string): Category {
  const text = `${subject} ${body}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.category;
  }
  return 'general_inquiry';
}

const CATEGORY_LABELS: Record<Category, string> = {
  payout_delay: 'Payout delay',
  refund_dispute: 'Refund / dispute',
  fraud_concern: 'Fraud / trust & safety',
  account_access: 'Account access',
  campaign_management: 'Campaign management',
  technical_bug: 'Technical bug',
  billing_question: 'Billing / fees',
  general_inquiry: 'General inquiry',
};

const CATEGORY_ACTIONS: Record<Category, string> = {
  payout_delay: 'Check the AI Payout Concierge for this campaign, confirm Stripe Connect onboarding is complete, and share the current payout timeline.',
  refund_dispute: 'Verify the charge in Stripe, then trigger a refund from the admin refunds queue if the duplicate or incorrect charge is confirmed.',
  fraud_concern: 'Escalate to Trust & Safety: review open risk flags for the campaign and consider freezing payouts pending investigation.',
  account_access: "Verify the user's identity, then help them regain account access or re-run Stripe identity verification.",
  campaign_management: 'Walk the organizer through the relevant campaign settings, or make the edit on their behalf if it requires admin access.',
  technical_bug: 'Reproduce the issue, capture the relevant details, and escalate to engineering with steps to reproduce.',
  billing_question: 'Explain the applicable platform fee and CharitScore methodology, linking to the relevant documentation.',
  general_inquiry: 'Respond with the relevant information and confirm the user has everything they need.',
};

function fallbackDraft(category: Category, campaignTitle: string | null): string {
  const greeting = 'Hi there,';
  const campaignRef = campaignTitle ? ` for "${campaignTitle}"` : '';
  const closing = "\n\nThanks for your patience — we're here to help.\n\nThe CharitMe Support Team";

  switch (category) {
    case 'payout_delay':
      return `${greeting}\n\nThanks for reaching out about your payout${campaignRef}. We're reviewing your account's payout status now and will confirm your Stripe Connect setup and current balance, then follow up shortly with an update on timing.${closing}`;
    case 'refund_dispute':
      return `${greeting}\n\nWe're sorry for the trouble with your donation${campaignRef}. We're looking into the charge now and, if a duplicate or incorrect charge is confirmed, we'll process a refund right away.${closing}`;
    case 'fraud_concern':
      return `${greeting}\n\nThank you for flagging this. We take trust and safety seriously, and our team is reviewing your campaign${campaignRef} now. We'll be in touch with next steps as soon as the review is complete.${closing}`;
    case 'account_access':
      return `${greeting}\n\nSorry for the trouble accessing your account. We're looking into this now and will help you regain access or complete verification as quickly as possible.${closing}`;
    case 'campaign_management':
      return `${greeting}\n\nThanks for your question about managing your campaign${campaignRef}. We've noted your request and will either guide you through the settings or make the change on your behalf.${closing}`;
    case 'technical_bug':
      return `${greeting}\n\nThanks for reporting this issue${campaignRef}. We've logged the details and our engineering team will investigate. We'll let you know as soon as it's resolved.${closing}`;
    case 'billing_question':
      return `${greeting}\n\nThanks for your question about fees on CharitMe. We'll send over a clear breakdown of the applicable charges and how they apply to your account.${closing}`;
    default:
      return `${greeting}\n\nThanks for reaching out${campaignRef}. We've received your message and our team will follow up with the information you need shortly.${closing}`;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await isAdmin(user.id, user.email);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!checkRateLimit(`complaint-resolver:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from('support_cases')
    .select('id, subject, body, priority, status, campaign_id, submitter_id')
    .eq('id', parsed.data.caseId)
    .maybeSingle<SupportCase>();

  if (caseError) return NextResponse.json({ error: caseError.message }, { status: 500 });
  if (!caseRow) return NextResponse.json({ error: 'Support case not found' }, { status: 404 });

  let campaignTitle: string | null = null;
  if (caseRow.campaign_id) {
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('title')
      .eq('id', caseRow.campaign_id)
      .maybeSingle();
    campaignTitle = campaign?.title ?? null;
  }

  const category = categorize(caseRow.subject, caseRow.body ?? '');
  const suggestedAction = CATEGORY_ACTIONS[category];
  let draftResponse = fallbackDraft(category, campaignTitle);
  let model = 'fallback';

  if (openai) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe Support AI. Draft a short (3-5 sentence), warm, professional reply to a support ticket. Use only facts from the input — never invent specific amounts, dates, or promises. Address the category and suggested action naturally. Sign off as "The CharitMe Support Team". Return strict JSON: {"draftResponse": string}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              subject: caseRow.subject,
              body: caseRow.body,
              priority: caseRow.priority,
              category: CATEGORY_LABELS[category],
              suggestedAction,
              campaignTitle,
            }),
          },
        ],
      });
      const json = JSON.parse(response.output_text) as { draftResponse?: string };
      if (typeof json.draftResponse === 'string' && json.draftResponse.trim()) {
        draftResponse = json.draftResponse.trim();
        model = OPENAI_MODEL;
      }
    } catch {
      // keep fallback draft
    }
  }

  const { data: generation } = await supabaseAdmin
    .from('ai_generations')
    .insert({
      user_id: user.id,
      campaign_id: caseRow.campaign_id,
      generation_type: 'complaint_resolver',
      prompt: { caseId: caseRow.id, category, suggestedAction },
      output: { category, suggestedAction, draftResponse },
      model,
    })
    .select('id')
    .single();

  const aiTriage = {
    category,
    categoryLabel: CATEGORY_LABELS[category],
    suggestedAction,
    draftResponse,
    model,
    generatedAt: new Date().toISOString(),
  };

  await supabaseAdmin
    .from('support_cases')
    .update({
      ai_triage: aiTriage,
      ai_generation_id: generation?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', caseRow.id);

  await supabaseAdmin.from('support_notes').insert({
    case_id: caseRow.id,
    author_id: user.id,
    body: `AI Complaint Resolver — Category: ${CATEGORY_LABELS[category]}\nSuggested action: ${suggestedAction}\n\nDraft response:\n${draftResponse}`,
    internal: true,
  });

  return NextResponse.json({
    category,
    categoryLabel: CATEGORY_LABELS[category],
    suggestedAction,
    draftResponse,
    model,
  });
}
