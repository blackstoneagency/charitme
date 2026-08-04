import { boundedQuery } from '../../../../../lib/query-timeout';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DEFAULT_OG_IMAGE } from '../../../../../lib/public-routes';
import { cache } from 'react';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { getPeerPage } from './get-peer';
import { ProgressBar, Card } from '../../../../../components/ui';
import { formatMoneyShort, DEFAULT_CURRENCY } from '@shared/currencies';
import DonateButton from '../../DonateButton';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// A supporter's own fundraising page.
//
// This is the URL peer-to-peer fundraising exists for: something a supporter can
// text to their friends that says "I'm raising money for this, through me". The
// roster on the campaign page could already show who was on the team; what it
// could not do was give each of them a page to share.
//
// ⚠️ WHY THIS COULD NOT SHIP EARLIER, and what changed.
//
// `peer_fundraisers.raised_amount` had no writer. Every one of the 240 seeded
// rows showed a total that no donation produced, and a donation made "through" a
// supporter was indistinguishable from a direct one — `donations` had no column
// naming the peer. So this page would have rendered a progress bar that could
// never move: a surface that looks alive and silently does nothing, which is the
// defect class this repo has spent the most effort removing.
//
// Two migrations close that:
//   20260815000000 — `donations.peer_fundraiser_id` + the trigger that rolls a
//                    completed attributed gift into the peer's total
//   20260816000000 — `record_donation` carries the peer id through the webhook
//
// Until BOTH are applied the bar is genuinely static, so this page says so out
// loud (`attributionLive` below) rather than presenting a frozen number as if it
// were live. Detection is by probing for the column, not by reading a flag
// someone has to remember to flip.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Is attribution actually recording yet?
 *
 * Probes `donations.peer_fundraiser_id`. PostgREST answers a select on a missing
 * column with `42703`, so this is a direct question about the deployed schema
 * rather than an assumption about which migrations have run — the same technique
 * `lib/campaign-visibility.ts` uses for optional campaign columns.
 */
const attributionColumnExists = cache(async (): Promise<boolean> => {
  const { error } = await boundedQuery(() => supabaseAdmin.from('donations').select('peer_fundraiser_id').limit(1));
  return !error;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; peerSlug: string }>;
}): Promise<Metadata> {
  const { slug, peerSlug } = await params;
  const found = await getPeerPage(slug, peerSlug);
  if (!found) return { title: 'Fundraiser not found' };
  const name = found.profile?.full_name ?? 'A supporter';
  const title = `${found.peer.title} — ${name} for ${found.campaign.title}`;
  return {
    title,
    description: `${name} is raising money for ${found.campaign.title} on CharitMe. Give through their page and it counts toward their total.`,
    openGraph: {
      title,
      description: `Support ${found.campaign.title} through ${name}.`,
      images: found.campaign.cover_image_url ? [found.campaign.cover_image_url] : [{ url: DEFAULT_OG_IMAGE }],
    },
  };
}

export default async function PeerFundraiserPage({
  params,
}: {
  params: Promise<{ slug: string; peerSlug: string }>;
}) {
  const { slug, peerSlug } = await params;
  const found = await getPeerPage(slug, peerSlug);
  if (!found) notFound();

  const { campaign, peer, profile } = found;
  const attributionLive = await attributionColumnExists();
  const name = profile?.full_name ?? 'A supporter';
  const canDonate = campaign.status === 'active' && campaign.visibility === 'public' && peer.status === 'active';

  return (
    <main id="main-content" style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 64px' }}>
      <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 16px' }}>
        <Link href={`/campaigns/${campaign.slug}`} style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
          ← {campaign.title}
        </Link>
      </p>

      <header style={{ marginBottom: 24 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--violet-ink)',
            marginBottom: 10,
          }}
        >
          Fundraising team
        </span>
        <h1 style={{ fontSize: 32, lineHeight: 1.15, fontWeight: 900, margin: '0 0 8px', color: 'var(--t1)' }}>
          {peer.title}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--t2)', margin: 0 }}>
          <strong>{name}</strong> is raising money for{' '}
          <Link href={`/campaigns/${campaign.slug}`} style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
            {campaign.title}
          </Link>
          .
        </p>
      </header>

      <Card>
        <div style={{ display: 'flex', minWidth: 0, alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <strong style={{ fontSize: 26, fontWeight: 900, color: 'var(--t1)' }}>
            {formatMoneyShort(peer.raised_amount, DEFAULT_CURRENCY)}
          </strong>
          <span style={{ fontSize: 14, color: 'var(--t3)' }}>
            raised of {formatMoneyShort(peer.goal_amount, DEFAULT_CURRENCY)} goal
          </span>
        </div>
        <ProgressBar value={peer.raised_amount} max={peer.goal_amount > 0 ? peer.goal_amount : 1} />

        {!attributionLive && (
          <p
            role="note"
            style={{
              margin: '14px 0 0',
              fontSize: 12.5,
              color: 'var(--t3)',
              lineHeight: 1.55,
              background: 'var(--s2)',
              border: '1px solid var(--b1)',
              borderRadius: 10,
              padding: '10px 12px',
            }}
          >
            Per-supporter totals are not being recorded yet on this deployment, so this figure will
            not move. Your donation still reaches <strong>{campaign.title}</strong> in full and is
            counted toward the campaign — only the split by supporter is pending.
          </p>
        )}
      </Card>

      <section style={{ marginTop: 24 }}>
        {canDonate ? (
          <DonateButton
            campaignId={campaign.id}
            campaignTitle={campaign.title}
            peerFundraiserId={peer.id}
          />
        ) : (
          <Card>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--t2)' }}>
              This fundraiser is not accepting donations right now.{' '}
              <Link href={`/campaigns/${campaign.slug}`} style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
                Visit the campaign
              </Link>{' '}
              to see its current status.
            </p>
          </Card>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', margin: '0 0 8px' }}>
          Where the money goes
        </h2>
        <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6, margin: 0 }}>
          Every donation on this page goes to <strong>{campaign.title}</strong>, exactly as it would
          on the campaign&apos;s own page — giving through {name} credits them for encouraging it, it
          does not route the money differently. CharitMe takes <strong>0%</strong>.
        </p>
      </section>
    </main>
  );
}
