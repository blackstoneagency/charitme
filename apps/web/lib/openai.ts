import 'server-only';
import OpenAI from 'openai';
import { z } from 'zod';
import { CAMPAIGN_CATEGORIES, type CampaignCategory } from '@shared/fees';
import { formatMoney, normalizeCurrency } from '@shared/currencies';
import { suggestMilestones, suggestUseOfFunds } from './campaign-builder-model';

const apiKey = process.env.OPENAI_API_KEY;

export const openai = apiKey ? new OpenAI({ apiKey }) : null;

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

export type AiCampaignRequest = {
  category: CampaignCategory;
  /** Integer cents. */
  goalAmount: number;
  currency?: string;
  beneficiary: string;
  notes: string;
  tone?: string;
  sourceLinks?: string[];
  sourceDocuments?: string[];
};

export const AiCampaignResponseSchema = z.object({
  title: z.string().trim().min(3).max(100),
  summary: z.string().trim().min(10).max(160),
  story: z.string().trim().min(20).max(10_000),
  category: z.enum(CAMPAIGN_CATEGORIES),
  suggestedGoalCents: z.number().int().min(100).max(1_000_000_000),
  useOfFunds: z.array(z.object({
    label: z.string().trim().min(2).max(120),
    amountCents: z.number().int().min(1).max(1_000_000_000),
  })).min(1).max(12),
  socialCaption: z.string().trim().min(10).max(500),
  longPost: z.string().trim().min(20).max(5000),
  sms: z.string().trim().min(10).max(500),
  email: z.string().trim().min(20).max(5000),
  donorFaq: z.array(z.object({
    question: z.string().trim().min(5).max(300),
    answer: z.string().trim().min(5).max(2000),
  })).min(1).max(10),
  donationTiers: z.array(z.object({
    amountCents: z.number().int().min(100).max(100_000_000),
    label: z.string().trim().min(2).max(120),
  })).min(1).max(8),
  milestones: z.array(z.object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1000),
    targetCents: z.number().int().min(1).max(1_000_000_000),
  })).min(1).max(10),
  seoTitle: z.string().trim().min(10).max(60),
  seoDescription: z.string().trim().min(20).max(160),
  coverImageGuidance: z.string().trim().min(10).max(500),
  missingTrustSignals: z.array(z.string().trim().min(2).max(200)).max(12),
  qualityScore: z.number().int().min(0).max(100),
});

export type AiCampaignResponse = z.infer<typeof AiCampaignResponseSchema>;

export function fallbackAiCampaign(input: AiCampaignRequest): AiCampaignResponse {
  const beneficiary = input.beneficiary || 'the beneficiary';
  const category = input.category || 'fundraiser';
  const goalCents = Math.max(100, Math.round(input.goalAmount || 500_000));
  const goalDisplay = formatMoney(goalCents, normalizeCurrency(input.currency));
  const useOfFunds = suggestUseOfFunds(goalCents, category).map(({ label, amountCents }) => ({ label, amountCents }));
  const milestones = suggestMilestones(goalCents).map(({ title, description, targetCents }) => ({ title, description, targetCents }));
  const title = `Help ${beneficiary} with ${category.toLowerCase()} support`.slice(0, 100).trim();
  const summary = `Help ${beneficiary} meet this ${category.toLowerCase()} need with a clear, accountable plan.`.slice(0, 160).trim();

  return {
    title,
    summary,
    story: `We are raising funds for ${beneficiary} because this need is urgent and real. Contributions will help cover the most important expenses, and updates will be shared through the CharitMe transparency ledger so donors can see progress and impact. ${input.notes}`,
    category,
    suggestedGoalCents: goalCents,
    useOfFunds,
    socialCaption: `Please help ${beneficiary}. Every donation and share can make a real difference.`,
    longPost: `I started a CharitMe campaign for ${beneficiary}. The goal is to raise ${goalDisplay} with transparent updates, donor receipts, and trust signals. Please consider donating or sharing.`,
    sms: `Can you help ${beneficiary}? Donate or share here: [campaign link]`,
    email: `Hi,\n\nI am raising funds for ${beneficiary}. Your support would help cover urgent expenses and every update will be shared transparently through CharitMe.\n\nThank you for considering a donation or share.`,
    donorFaq: [
      { question: 'How will funds be used?', answer: 'The campaign budget lists the planned expenses, and updates will document meaningful changes.' },
      { question: 'Who receives the payout?', answer: `${beneficiary} is the intended beneficiary, with payouts managed through a verified account.` },
      { question: 'Will updates be shared?', answer: 'Yes. Progress and material changes will be posted on the campaign.' },
    ],
    donationTiers: [
      { amountCents: 2_500, label: 'Covers an immediate essential' },
      { amountCents: 7_500, label: 'Helps with a meaningful next step' },
      { amountCents: 15_000, label: 'Moves the campaign noticeably closer' },
    ],
    milestones,
    seoTitle: `Support ${beneficiary} | CharitMe Fundraiser`.slice(0, 60),
    seoDescription: summary.slice(0, 160),
    coverImageGuidance: `Use a clear, well-lit photo that shows ${beneficiary} or the real ${category.toLowerCase()} need without private documents or sensitive details.`,
    missingTrustSignals: ['Add beneficiary verification', 'Upload receipt or proof', 'Connect Stripe payout account'],
    qualityScore: 72,
  };
}
