import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const REPO = join(ROOT, '..', '..');
const readWeb = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const readRepo = (path: string) => readFileSync(join(REPO, path), 'utf8');

describe('one Supabase-backed checkout configuration reaches every donation surface', () => {
  const serverSurfaces = [
    'app/campaigns/[slug]/(detail)/page.tsx',
    'app/campaigns/[slug]/embed/page.tsx',
    'app/campaigns/[slug]/team/[peerSlug]/page.tsx',
    'app/donate/[slug]/page.tsx',
    'app/donate/page.tsx',
    'app/transparency/page.tsx',
  ];

  it.each(serverSurfaces)('%s loads the shared settings snapshot', (path) => {
    expect(readWeb(path)).toContain('getDonationCheckoutSnapshot');
  });

  it('the campaign checkout renders configured amounts, support tiers, and processor estimates', () => {
    const checkout = readWeb('app/campaigns/[slug]/DonateButton.tsx');
    expect(checkout).toContain('checkout.amountPresetsCents.map');
    expect(checkout).toContain('checkout.supportTierPercents.map');
    expect(checkout).toContain('methodFees: checkout.methodFees');
    expect(checkout).toContain('checkoutRevision');
    expect(checkout).toContain('Payment method &amp; processing fee estimate');
    expect(checkout).toContain('CharitMe fee');
    expect(checkout).toContain('setMethodOpen((o) => !o)');
    expect(checkout).toContain('role="radiogroup"');
  });

  it('the former direct and guided checkouts delegate to the campaign checkout', () => {
    expect(readWeb('app/donate/DonateForm.tsx')).toContain('<DonateButton');
    expect(readWeb('app/donate/[slug]/GuidedDonation.tsx')).toContain('<DonateButton');
  });
});

describe('checkout pricing is authoritative at session creation', () => {
  const routes = [
    'app/api/donations/route.ts',
    'app/api/donations/recurring/route.ts',
  ];

  it.each(routes)('%s rejects a stale settings revision', (path) => {
    const route = readWeb(path);
    expect(route).toContain('getDonationCheckoutSnapshot');
    expect(route).toContain('checkoutRevision');
    expect(route).toContain('CHECKOUT_CONFIG_CHANGED');
    expect(route).toMatch(/status:\s*409/);
  });

  it.each(routes)('%s uses the live default CharitMe fee', (path) => {
    expect(readWeb(path)).toContain('checkout.settings.defaultSupportPercent');
  });

  // ⚠️ Portfolio split gifts are WITHDRAWN, but this stays: the webhook must
  // still settle a session created before the withdrawal shipped, and getting
  // the per-campaign allocation wrong there misreports money that has already
  // been charged. It can go once no unpaid portfolio session can remain.
  it('still records support and processor coverage to the cent for in-flight portfolio gifts', () => {
    const webhook = readWeb('app/api/stripe/webhook/route.ts');
    expect(webhook).toContain('allocateCentsProportionally');
    expect(webhook).toContain('Number(meta.tipCents ?? 0)');
    expect(webhook).toContain('Number(meta.processingFeeCents ?? 0)');
  });

});

describe('Super Admin owns the checkout pricing record', () => {
  it('exposes all configurable pricing groups and saves the nested object', () => {
    const client = readWeb('app/admin/super/settings/SettingsClient.tsx');
    expect(client).toContain('Donation checkout &amp; CharitMe fee');
    expect(client).toContain('Donation amount buttons');
    expect(client).toContain('Optional CharitMe fee choices');
    expect(client).toContain('Payment processing estimates');
    expect(client).toContain('const payload: Record<string, unknown> = { ...rest }');
  });

  it('validates references, keeps 0%, nests payment settings, and invalidates public caches', () => {
    const route = readWeb('app/api/admin/super/settings/route.ts');
    expect(route).toContain("values.includes(0)");
    expect(route).toContain('amountPresetsCents.includes(value.popularAmountCents)');
    expect(route).toContain('supportTierPercents.includes(value.defaultSupportPercent)');
    expect(route).toContain('nextConfig.payment');
    expect(route).toContain("revalidateTag('donation-checkout-settings')");
  });

  it('has an idempotent seed and a release rollback', () => {
    const migration = readRepo('supabase/migrations/20260902010000_donation_checkout_settings.sql');
    const rollback = readRepo('supabase/rollbacks/20260902010000_rollback_donation_checkout_settings.sql');
    expect(migration).toContain("'{payment,donationCheckout}'");
    expect(migration).toContain('on conflict (id) do update');
    expect(rollback).toContain("config #- '{payment,donationCheckout}'");
  });
});
