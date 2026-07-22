import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  resolveFeaturePriceCents,
  selectRotatorCampaigns,
  FEATURE_PRICE_DEFAULT_CENTS,
  FEATURE_PRICE_MIN_CENTS,
  FEATURE_PRICE_MAX_CENTS,
} from '../lib/featured';

describe('resolveFeaturePriceCents', () => {
  it('reads the admin-configured price from payment settings', () => {
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 500 })).toBe(500);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 2500 })).toBe(2500);
  });

  it('falls back to the $5 default when unset, zero, or non-numeric', () => {
    expect(resolveFeaturePriceCents(undefined)).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents({})).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 0 })).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 'abc' })).toBe(FEATURE_PRICE_DEFAULT_CENTS);
    expect(resolveFeaturePriceCents(null)).toBe(FEATURE_PRICE_DEFAULT_CENTS);
  });

  it('clamps out-of-range values to the sane min/max', () => {
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 5 })).toBe(FEATURE_PRICE_MIN_CENTS);
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 9_999_999 })).toBe(FEATURE_PRICE_MAX_CENTS);
  });

  it('rounds fractional cents to whole cents', () => {
    expect(resolveFeaturePriceCents({ featuredCampaignPriceCents: 599.6 })).toBe(600);
  });
});

describe('selectRotatorCampaigns', () => {
  const c = (id: string, featured: boolean) => ({ id, featured });

  it('returns only featured campaigns when at least one is featured', () => {
    const list = [c('a', false), c('b', true), c('c', false), c('d', true)];
    expect(selectRotatorCampaigns(list).map((x) => x.id)).toEqual(['b', 'd']);
  });

  it('falls back to the full list when none are featured (hero never empty)', () => {
    const list = [c('a', false), c('b', false)];
    expect(selectRotatorCampaigns(list)).toHaveLength(2);
  });

  it('preserves the input order of featured campaigns (callers pre-sort by rank)', () => {
    const list = [c('x', true), c('y', false), c('z', true)];
    expect(selectRotatorCampaigns(list).map((x) => x.id)).toEqual(['x', 'z']);
  });

  it('treats missing/null featured as not-featured', () => {
    const list = [{ id: 'a' }, { id: 'b', featured: null }, { id: 'c', featured: true }];
    expect(selectRotatorCampaigns(list).map((x) => x.id)).toEqual(['c']);
  });
});

describe('featured campaign production contracts', () => {
  const readSource = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');
  const routeSource = readSource('app/api/campaigns/[id]/feature/route.ts');
  const webhookSource = readSource('app/api/stripe/webhook/route.ts');
  const buttonSource = readSource('app/dashboard/campaigns/[id]/_components/FeatureCampaignButton.tsx');

  it('requires auth, ownership, and idempotent Stripe checkout metadata', () => {
    expect(routeSource).toContain("if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })");
    expect(routeSource).toContain('canManageCampaign(user, campaign.user_id)');
    expect(routeSource).toContain("metadata: {\n      type: 'feature_campaign'");
    expect(routeSource).toContain('`feature_${campaign.id}_${user.id}`');
    expect(routeSource).toContain("if (!session.url)");
    expect(routeSource).toContain("{ error: 'Could not start checkout' }");
  });

  it('binds paid webhook activation to the campaign owner and one-time state', () => {
    expect(webhookSource).toContain("meta.type === 'feature_campaign'");
    expect(webhookSource).toContain("session.payment_status === 'paid'");
    expect(webhookSource).toContain(".eq('user_id', meta.userId ?? '')");
    expect(webhookSource).toContain(".eq('featured', false)");
  });

  it('keeps the organizer control honest before and after payment', () => {
    expect(buttonSource).toContain('if (featured)');
    expect(buttonSource).toContain('Feature this campaign');
    expect(buttonSource).toContain("method: 'POST'");
    expect(buttonSource).toContain('window.location.assign(json.url)');
  });
});
