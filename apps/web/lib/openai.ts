import 'server-only';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

export const openai = apiKey ? new OpenAI({ apiKey }) : null;

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

export type AiCampaignRequest = {
  category: string;
  goalAmount: number;
  beneficiary: string;
  notes: string;
  tone?: string;
};

export type AiCampaignResponse = {
  title: string;
  story: string;
  socialCaption: string;
  longPost: string;
  sms: string;
  email: string;
  donorFaq: string[];
  donationTiers: { amount: number; label: string }[];
  missingTrustSignals: string[];
  qualityScore: number;
};

export function fallbackAiCampaign(input: AiCampaignRequest): AiCampaignResponse {
  const beneficiary = input.beneficiary || 'the beneficiary';
  const category = input.category || 'fundraiser';
  const goal = Math.max(100, Math.round(input.goalAmount || 5000));

  return {
    title: `Help ${beneficiary} with ${category.toLowerCase()} support`,
    story: `We are raising funds for ${beneficiary} because this need is urgent and real. Contributions will help cover the most important expenses, and updates will be shared through the CharitMe transparency ledger so donors can see progress and impact. ${input.notes}`,
    socialCaption: `Please help ${beneficiary}. Every donation and share can make a real difference.`,
    longPost: `I started a CharitMe campaign for ${beneficiary}. The goal is to raise $${goal.toLocaleString()} with transparent updates, donor receipts, and trust signals. Please consider donating or sharing.`,
    sms: `Can you help ${beneficiary}? Donate or share here: [campaign link]`,
    email: `Hi,\n\nI am raising funds for ${beneficiary}. Your support would help cover urgent expenses and every update will be shared transparently through CharitMe.\n\nThank you for considering a donation or share.`,
    donorFaq: ['How will funds be used?', 'Who receives the payout?', 'Will updates be shared?'],
    donationTiers: [
      { amount: 25, label: 'Covers an immediate essential' },
      { amount: 75, label: 'Helps with a meaningful next step' },
      { amount: 150, label: 'Moves the campaign noticeably closer' },
    ],
    missingTrustSignals: ['Add beneficiary verification', 'Upload receipt or proof', 'Connect Stripe payout account'],
    qualityScore: 72,
  };
}
