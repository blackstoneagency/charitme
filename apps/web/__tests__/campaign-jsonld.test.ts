import { describe, it, expect } from 'vitest';
import { buildCampaignJsonLd, type CampaignJsonLdInput } from '../lib/campaign-jsonld';

const base: CampaignJsonLdInput = {
  title: 'Help Sarah Fight Cancer',
  description: 'Sarah needs support for treatment.',
  url: 'https://www.charitme.com/campaigns/help-sarah',
  image: 'https://img.example/cover.jpg',
  organizerName: 'Jane Doe',
  category: 'Medical',
  createdAt: '2026-01-02T03:04:05Z',
  isActive: true,
  siteOrigin: 'https://www.charitme.com',
  nonprofitVerified: false,
};

describe('buildCampaignJsonLd', () => {
  it('emits a valid schema.org WebPage node with the core fields', () => {
    const n = buildCampaignJsonLd(base);
    expect(n['@context']).toBe('https://schema.org');
    expect(n['@type']).toBe('WebPage');
    expect(n.name).toBe(base.title);
    expect(n.url).toBe(base.url);
    expect(n.primaryImageOfPage).toBe(base.image);
    expect(n.datePublished).toBe(base.createdAt);
    expect(n.publisher).toMatchObject({ '@type': 'Organization', name: 'CharitMe' });
    expect(n.isPartOf).toMatchObject({ '@type': 'WebSite', name: 'CharitMe' });
  });

  it('models an individual organizer as a Person recipient', () => {
    const n = buildCampaignJsonLd(base);
    expect(n.author).toEqual({ '@type': 'Person', name: 'Jane Doe' });
    const action = n.potentialAction as Record<string, unknown>;
    expect(action.recipient).toEqual({ '@type': 'Person', name: 'Jane Doe' });
  });

  it('models a verified nonprofit as an Organization recipient', () => {
    const n = buildCampaignJsonLd({ ...base, nonprofitVerified: true });
    expect(n.author).toEqual({ '@type': 'Organization', name: 'Jane Doe' });
  });

  it('includes a DonateAction pointing at the donate anchor when active', () => {
    const n = buildCampaignJsonLd(base);
    const action = n.potentialAction as Record<string, unknown>;
    expect(action['@type']).toBe('DonateAction');
    expect(action.name).toBe('Donate to Help Sarah Fight Cancer');
    expect(action.target).toMatchObject({
      '@type': 'EntryPoint',
      urlTemplate: 'https://www.charitme.com/campaigns/help-sarah#donate-section',
    });
  });

  it('omits the DonateAction for a closed/inactive campaign', () => {
    const n = buildCampaignJsonLd({ ...base, isActive: false });
    expect(n.potentialAction).toBeUndefined();
  });

  it('falls back to the campaign title when there is no organizer name', () => {
    const n = buildCampaignJsonLd({ ...base, organizerName: null });
    expect(n.author).toEqual({ '@type': 'Person', name: base.title });
    const n2 = buildCampaignJsonLd({ ...base, organizerName: '   ' });
    expect(n2.author).toEqual({ '@type': 'Person', name: base.title });
  });

  it('drops empty optional fields from the emitted markup', () => {
    // JSON.stringify (what actually ships) omits undefined-valued keys.
    const n = buildCampaignJsonLd({ ...base, description: '', image: '', createdAt: null, category: null });
    const emitted = JSON.parse(JSON.stringify(n));
    expect(emitted).not.toHaveProperty('description');
    expect(emitted).not.toHaveProperty('primaryImageOfPage');
    expect(emitted).not.toHaveProperty('datePublished');
    expect(emitted).not.toHaveProperty('about');
    // required fields survive
    expect(emitted.name).toBe(base.title);
    expect(emitted.url).toBe(base.url);
  });
});
