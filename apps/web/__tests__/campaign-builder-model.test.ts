import { describe, expect, it } from 'vitest';
import {
  parseCampaignFaqs,
  parseCampaignMilestones,
  parseDonationTiers,
  parseSourceDocuments,
  parseSourceLinks,
  parseUseOfFunds,
  suggestMilestones,
  suggestUseOfFunds,
  totalUseOfFunds,
  validateCampaignBuilderSettings,
} from '../lib/campaign-builder-model';

describe('campaign builder shared model', () => {
  it('parses and bounds rich draft fields without throwing', () => {
    expect(parseUseOfFunds('not json')).toEqual([]);
    expect(parseDonationTiers('[{"amountCents":2500,"label":"Essentials"}]')).toHaveLength(1);
    expect(parseCampaignFaqs('[{"question":"Where does it go?","answer":"Directly to care.","aiGenerated":true}]'))
      .toMatchObject([{ question: 'Where does it go?', aiGenerated: true }]);
    expect(parseCampaignMilestones('[{"title":"Halfway","targetCents":50000}]'))
      .toMatchObject([{ title: 'Halfway', targetCents: 50000 }]);
  });

  it('accepts only HTTP source links', () => {
    const raw = JSON.stringify([
      { id: 'one', url: 'https://example.com/plan' },
      { id: 'two', url: 'javascript:alert(1)' },
    ]);
    expect(parseSourceLinks(raw)).toEqual([{ id: 'one', url: 'https://example.com/plan' }]);
  });

  it('keeps only private document metadata in the source-document model', () => {
    const raw = JSON.stringify([
      { id: 'doc', name: 'plan.pdf', mediaType: 'document', mimeType: 'application/pdf', sizeBytes: 200, storagePath: 'campaigns/user/sources/plan.pdf', publicUrl: '' },
      { id: 'image', name: 'photo.png', mediaType: 'image', mimeType: 'image/png', sizeBytes: 200, storagePath: 'campaigns/user/sources/photo.png', publicUrl: '' },
    ]);
    expect(parseSourceDocuments(raw)).toMatchObject([{ id: 'doc', mediaType: 'document', publicUrl: '' }]);
  });

  it('builds an exact integer-cent use-of-funds plan', () => {
    const plan = suggestUseOfFunds(1_000_01, 'Medical');
    expect(totalUseOfFunds(plan)).toBe(1_000_01);
    expect(plan.every((item) => Number.isSafeInteger(item.amountCents))).toBe(true);
  });

  it('builds ordered milestones ending at the exact goal', () => {
    const milestones = suggestMilestones(12_345);
    expect(milestones.map((item) => item.targetCents)).toEqual([3086, 6173, 9259, 12345]);
  });

  it('preserves unfinished live editor rows so users can finish typing them', () => {
    expect(parseDonationTiers('[{"id":"new-tier","label":"","amountCents":0}]')).toHaveLength(1);
    expect(parseCampaignFaqs('[{"id":"new-faq","question":"","answer":"","aiGenerated":false}]')).toHaveLength(1);
    expect(parseCampaignMilestones('[{"id":"new-milestone","title":"","description":"","targetCents":0}]')).toHaveLength(1);
    expect(parseUseOfFunds('[{"id":"new-fund","label":"","amountCents":0}]')).toHaveLength(1);
  });

  it('blocks incomplete optional settings before the publish request', () => {
    expect(validateCampaignBuilderSettings({
      donationTiers: [{ id: 'tier', label: '', amountCents: 0 }],
      faqs: [],
      milestones: [],
    })).toContain('donation amount');
    expect(validateCampaignBuilderSettings({
      donationTiers: [],
      faqs: [{ id: 'faq', question: '', answer: '', aiGenerated: false }],
      milestones: [],
    })).toContain('FAQ');
    expect(validateCampaignBuilderSettings({
      donationTiers: [],
      faqs: [],
      milestones: [{ id: 'milestone', title: '', description: '', targetCents: 0 }],
    })).toContain('milestone');
  });
});
