import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { boundedQuery } from '../../lib/query-timeout';
import { campaignColumns, applyLiveFilters } from '../../lib/campaign-visibility';
import GiveClient, { type GiveCampaign } from './GiveClient';
import { getDonationCheckoutSnapshot } from '../../lib/donation-checkout-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Give Once, Fund Many | CharitMe',
  description:
    'Support several fundraisers with a single donation. Choose your causes, give one amount, and CharitMe splits it to the cent. 0% platform fee.',
  alternates: { canonical: 'https://www.charitme.com/give' },
};

// G4 from the GoFundMe teardown. Their answer is a "Nonprofit Giving Cart";
// this is deliberately not a cart — one amount, several causes, one receipt.
//
// Ranked by campaign health rather than amount raised: a portfolio page that
// lists the biggest campaigns first would funnel a "spread it around" donor into
// the fundraisers that need it least, which is the opposite of the point.

async function getCampaigns(): Promise<GiveCampaign[]> {
  try {
    const cols = await campaignColumns();
    const { data } = await boundedQuery(() =>
  applyLiveFilters(
        supabaseAdmin
          .from('campaigns')
          .select('id, slug, title, tagline, category, cover_image_url, raised_amount, goal_amount, campaign_health_score'),
        cols,
      )
        .order('campaign_health_score', { ascending: false, nullsFirst: false })
        .limit(24),
    );
    return (data ?? []) as GiveCampaign[];
  } catch {
    return [];
  }
}

export default async function GivePage() {
  const [campaigns, checkout] = await Promise.all([
    getCampaigns(),
    getDonationCheckoutSnapshot(),
  ]);

  return (
    <main id="main-content" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 64px' }}>
      <header style={{ marginBottom: 28 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 0,
            textTransform: 'uppercase',
            color: 'var(--violet-ink)',
            marginBottom: 10,
          }}
        >
          Give once, fund many
        </span>
        <h1 style={{ fontSize: 36, lineHeight: 1.15, fontWeight: 900, margin: '0 0 10px', color: 'var(--t1)' }}>
          One gift. Several causes.
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--t2)', margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
          Choose the fundraisers you want to back, name one amount, and we divide it to the cent —
          one payment, one receipt, and <strong>0%</strong> taken by the platform.
        </p>
      </header>

      <GiveClient
        campaigns={campaigns}
        checkoutSettings={checkout.settings}
        checkoutRevision={checkout.revision}
      />
    </main>
  );
}
