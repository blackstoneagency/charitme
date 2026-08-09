export const CAMPAIGN_BUILDER_SCHEMA_VERSION = 2;

export type CampaignBuilderPath = 'ai' | 'guided';

export type UseOfFundsItem = {
  id: string;
  label: string;
  amountCents: number;
};

export type DonationTier = {
  id: string;
  amountCents: number;
  label: string;
};

export type CampaignFaq = {
  id: string;
  question: string;
  answer: string;
  aiGenerated: boolean;
};

export type CampaignMilestone = {
  id: string;
  title: string;
  description: string;
  targetCents: number;
};

export type CampaignSourceLink = {
  id: string;
  url: string;
};

export type CampaignSourceDocument = {
  id: string;
  name: string;
  mediaType: 'document';
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  publicUrl: string;
};

function parseArray(raw: string): unknown[] {
  if (!raw.trim()) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function centsValue(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function idValue(value: unknown, prefix: string, index: number): string {
  const id = stringValue(value);
  return id || `${prefix}-${index + 1}`;
}

export function parseUseOfFunds(raw: string): UseOfFundsItem[] {
  return parseArray(raw).flatMap((value, index) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    if (!('id' in row || 'label' in row || 'amountCents' in row)) return [];
    const label = stringValue(row.label);
    const amountCents = centsValue(row.amountCents);
    return [{ id: idValue(row.id, 'fund', index), label, amountCents }];
  }).slice(0, 12);
}

export function parseDonationTiers(raw: string): DonationTier[] {
  return parseArray(raw).flatMap((value, index) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    if (!('id' in row || 'label' in row || 'amountCents' in row)) return [];
    const label = stringValue(row.label);
    const amountCents = centsValue(row.amountCents);
    return [{ id: idValue(row.id, 'tier', index), label, amountCents }];
  }).slice(0, 8);
}

export function parseCampaignFaqs(raw: string): CampaignFaq[] {
  return parseArray(raw).flatMap((value, index) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    if (!('id' in row || 'question' in row || 'answer' in row)) return [];
    const question = stringValue(row.question);
    const answer = stringValue(row.answer);
    return [{
      id: idValue(row.id, 'faq', index),
      question,
      answer,
      aiGenerated: row.aiGenerated === true,
    }];
  }).slice(0, 10);
}

export function parseCampaignMilestones(raw: string): CampaignMilestone[] {
  return parseArray(raw).flatMap((value, index) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    if (!('id' in row || 'title' in row || 'description' in row || 'targetCents' in row)) return [];
    const title = stringValue(row.title);
    const description = stringValue(row.description);
    const targetCents = centsValue(row.targetCents);
    return [{ id: idValue(row.id, 'milestone', index), title, description, targetCents }];
  }).slice(0, 10);
}

export function parseSourceLinks(raw: string): CampaignSourceLink[] {
  return parseArray(raw).flatMap((value, index) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    const url = stringValue(row.url);
    if (!url) return [];
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return [];
      return [{ id: idValue(row.id, 'link', index), url: parsed.toString() }];
    } catch {
      return [];
    }
  }).slice(0, 5);
}

export function parseSourceDocuments(raw: string): CampaignSourceDocument[] {
  return parseArray(raw).flatMap((value, index) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    const name = stringValue(row.name);
    const mediaType: CampaignSourceDocument['mediaType'] | null = row.mediaType === 'document' ? 'document' : null;
    const mimeType = stringValue(row.mimeType);
    const sizeBytes = centsValue(row.sizeBytes);
    const storagePath = stringValue(row.storagePath);
    const publicUrl = stringValue(row.publicUrl);
    if (!name || !mediaType || sizeBytes === 0) return [];
    return [{
      id: idValue(row.id, 'source', index),
      name,
      mediaType,
      mimeType,
      sizeBytes,
      storagePath,
      publicUrl,
    }];
  }).slice(0, 10);
}

export function stringifyBuilderItems(value: readonly unknown[]): string {
  return JSON.stringify(value);
}

export function totalUseOfFunds(items: readonly UseOfFundsItem[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

export function validateCampaignBuilderSettings(input: {
  donationTiers: readonly DonationTier[];
  faqs: readonly CampaignFaq[];
  milestones: readonly CampaignMilestone[];
}): string | null {
  if (input.donationTiers.some((item) => item.label.length < 1 || item.label.length > 120 || item.amountCents < 100 || item.amountCents > 100_000_000)) {
    return 'Complete every suggested donation amount with a label and an amount of at least one currency unit.';
  }
  if (input.faqs.some((item) => item.question.length < 5 || item.question.length > 300 || item.answer.length < 5 || item.answer.length > 2000)) {
    return 'Complete every FAQ with a question and answer, or remove the unfinished FAQ.';
  }
  if (input.milestones.some((item) => item.title.length < 2 || item.title.length > 160 || item.description.length > 1000 || item.targetCents < 1 || item.targetCents > 1_000_000_000)) {
    return 'Complete every milestone with a title and target amount, or remove the unfinished milestone.';
  }
  return null;
}

export function suggestUseOfFunds(goalCents: number, category: string): UseOfFundsItem[] {
  const goal = Math.max(0, Math.round(goalCents));
  if (goal === 0) return [];
  const labelsByCategory: Record<string, readonly [string, string, string]> = {
    Medical: ['Treatment and care', 'Travel and recovery', 'Essential living costs'],
    Education: ['Tuition and fees', 'Books and supplies', 'Travel and living costs'],
    Emergency: ['Immediate essentials', 'Safe temporary housing', 'Recovery and repairs'],
    Nonprofit: ['Program delivery', 'People and materials', 'Community outreach'],
    Faith: ['Direct community support', 'Materials and transport', 'Program operations'],
    Animal: ['Veterinary care', 'Food and medication', 'Recovery and shelter'],
  };
  const labels = labelsByCategory[category] ?? ['Primary need', 'Supporting costs', 'Contingency and follow-up'];
  const first = Math.floor(goal * 0.6);
  const second = Math.floor(goal * 0.25);
  return [
    { id: 'fund-1', label: labels[0], amountCents: first },
    { id: 'fund-2', label: labels[1], amountCents: second },
    { id: 'fund-3', label: labels[2], amountCents: goal - first - second },
  ];
}

export function suggestMilestones(goalCents: number): CampaignMilestone[] {
  const goal = Math.max(0, Math.round(goalCents));
  if (goal === 0) return [];
  return [25, 50, 75, 100].map((percent, index) => ({
    id: `milestone-${index + 1}`,
    title: percent === 100 ? 'Campaign goal reached' : `${percent}% funded`,
    description: percent === 100 ? 'The full plan can move forward.' : 'Share a progress update and thank supporters.',
    targetCents: Math.round(goal * percent / 100),
  }));
}
