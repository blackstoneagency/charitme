import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/roles';

export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  ledgerItemId: z.string().uuid(),
});

const RISK_REVIEW_THRESHOLD = 50;
const RISK_HIGH_THRESHOLD = 75;

const TYPE_LABELS: Record<string, string> = {
  expense: 'an expense',
  receipt: 'a receipt / proof of purchase',
  payout: 'a payout',
  milestone: 'a milestone update',
  impact_update: 'an impact update',
  offline_donation: 'an offline donation',
  other: 'an update',
};

type LedgerItem = {
  id: string;
  campaign_id: string;
  item_type: string;
  title: string;
  description: string | null;
  category: string | null;
  amount_cents: number | null;
  receipt_url: string | null;
  status: string;
};

type Campaign = {
  id: string;
  title: string;
  user_id: string;
  raised_amount: number;
  goal_amount: number;
};

function computeRiskScore(item: LedgerItem, campaign: Campaign): number {
  let score = 0;
  const amount = item.amount_cents ?? 0;
  const raised = campaign.raised_amount ?? 0;

  if (['expense', 'payout', 'receipt'].includes(item.item_type)) {
    if (!item.receipt_url) score += 25;
    if (amount > 0 && raised > 0 && amount > raised * 0.5) score += 30;
    if (amount >= 100_000) score += 15; // $1,000+
  }

  if (item.item_type === 'payout' && amount > 0 && raised > 0 && amount > raised * 0.9) {
    score += 15;
  }

  if (!item.description || item.description.trim().length < 20) score += 15;

  return Math.min(100, score);
}

function fallbackSummary(item: LedgerItem, campaign: Campaign): string {
  const typeLabel = TYPE_LABELS[item.item_type] ?? 'an update';
  const amountStr = item.amount_cents
    ? `$${(item.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  let text = `This entry records ${typeLabel}${amountStr ? ` of ${amountStr}` : ''} for "${campaign.title}"`;
  if (item.category) text += ` (category: ${item.category})`;
  text += '. ';
  text += item.description?.trim()
    ? item.description.trim()
    : 'The organizer has not yet provided additional details for this entry.';
  if (item.receipt_url) text += ' A supporting receipt has been uploaded for this entry.';
  return text;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  if (!(await checkRateLimitDurable(`ai-impact:${ip}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Too many AI requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from('transparency_ledger_items')
    .select('id, campaign_id, item_type, title, description, category, amount_cents, receipt_url, status')
    .eq('id', parsed.data.ledgerItemId)
    .maybeSingle<LedgerItem>();

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  if (!item) return NextResponse.json({ error: 'Ledger item not found' }, { status: 404 });

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, user_id, raised_amount, goal_amount')
    .eq('id', item.campaign_id)
    .maybeSingle<Campaign>();

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const admin = await isAdmin(user.id, user.email);
  if (campaign.user_id !== user.id && !admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const riskScore = computeRiskScore(item, campaign);
  const reviewStatus: 'auto_approved' | 'pending_review' = riskScore >= RISK_REVIEW_THRESHOLD ? 'pending_review' : 'auto_approved';

  let summary = fallbackSummary(item, campaign);
  let model = 'fallback';

  if (openai) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe Impact Ledger AI. Write a short (2-3 sentence), warm, plain-English, donor-facing summary explaining a transparency ledger entry. Only use facts present in the input — never invent amounts, vendors, or outcomes. Return strict JSON: {"summary": string}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              campaignTitle: campaign.title,
              entryType: item.item_type,
              title: item.title,
              description: item.description,
              category: item.category,
              amountCents: item.amount_cents,
              hasReceipt: !!item.receipt_url,
            }),
          },
        ],
      });

      const text = response.output_text;
      const json = JSON.parse(text) as { summary?: string };
      if (typeof json.summary === 'string' && json.summary.trim()) {
        summary = json.summary.trim();
        model = OPENAI_MODEL;
      }
    } catch {
      // keep fallback summary
    }
  }

  const { data: generation, error: generationError } = await supabaseAdmin
    .from('ai_generations')
    .insert({
      user_id: user.id,
      campaign_id: campaign.id,
      generation_type: 'impact_ledger_summary',
      prompt: {
        ledgerItemId: item.id,
        itemType: item.item_type,
        title: item.title,
        description: item.description,
        category: item.category,
        amountCents: item.amount_cents,
        hasReceipt: !!item.receipt_url,
      },
      output: { summary, riskScore, reviewStatus },
      model,
    })
    .select('id')
    .single();

  if (generationError) return NextResponse.json({ error: generationError.message }, { status: 500 });

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('transparency_ledger_items')
    .update({
      ai_summary: summary,
      risk_score: riskScore,
      review_status: reviewStatus,
      ai_generation_id: generation.id,
    })
    .eq('id', item.id)
    .select('id, ai_summary, risk_score, review_status')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (reviewStatus === 'pending_review') {
    // The ledger item is already parked in `pending_review` above. If this flag
    // is lost the item stays parked with nothing in the review queue pointing at
    // it, so it waits on a moderator who was never told.
    const { error: flagErr } = await supabaseAdmin.from('risk_flags').insert({
      campaign_id: campaign.id,
      user_id: campaign.user_id,
      code: 'ledger_item_review',
      label: 'Transparency ledger entry needs review',
      flag_type: 'ledger_item_review',
      severity: riskScore >= RISK_HIGH_THRESHOLD ? 'high' : 'medium',
      description: `Ledger entry "${item.title}" (${item.item_type}) on "${campaign.title}" was flagged for review — AI risk score ${riskScore}/100.`,
      metadata: { ledger_item_id: item.id, risk_score: riskScore },
    });
    if (flagErr) {
      console.error('[ai/impact-summary] risk_flags insert failed', {
        campaign_id: campaign.id,
        ledger_item_id: item.id,
        risk_score: riskScore,
        message: flagErr.message,
      });
    }
  }

  return NextResponse.json({ ...updated, model });
}
