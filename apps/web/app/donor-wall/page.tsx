import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { campaignColumns } from '../../lib/campaign-visibility';
import { mapRecentDonations, type RawDonationRow, type RecentDonation } from '../../lib/home-data';
import { formatCents } from '../../lib/stripe';
import { EmptyState } from '../../components/ui';
import { PageBody, PageHero, Section, CardGrid, StatCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Donor Wall',
  description:
    'Thank you to the supporters funding campaigns on CharitMe — the most recent gifts and the largest, with anonymity always respected.',
  alternates: { canonical: 'https://www.charitme.com/donor-wall' },
};

export const revalidate = 300;

const SELECT_BASE =
  'id, amount_cents, anonymous, created_at, offline_donor_name, profiles:donor_id(full_name, show_public_profile)';

interface WallData {
  top: RecentDonation[];
  recent: RecentDonation[];
  totalDonors: number | null;
  totalRaisedCents: number;
}

/**
 * Donor lists for the public wall.
 *
 * Redaction goes through `mapRecentDonations`, deliberately, rather than a
 * second implementation here. It applies TWO independent gates — the
 * per-donation `anonymous` flag AND the account-wide "show public profile"
 * setting — and it exists because only the first was honoured once, so a donor
 * who set their profile to Private but did not tick "anonymous" was named in
 * the homepage ticker. A wall of donor names is the very worst place to repeat
 * that, so this page reuses the proven transform and only controls the ordering.
 */
async function getWall(): Promise<WallData | null> {
  try {
    const cols = await campaignColumns();
    const campaignJoin = cols.visibility
      ? 'campaigns:campaign_id(title, slug, visibility)'
      : 'campaigns:campaign_id(title, slug)';
    const select = `${SELECT_BASE}, ${campaignJoin}`;

    const [topRes, recentRes, countRes] = await Promise.all([
      supabaseAdmin.from('donations').select(select).eq('status', 'completed')
        .order('amount_cents', { ascending: false }).limit(30),
      supabaseAdmin.from('donations').select(select).eq('status', 'completed')
        .order('created_at', { ascending: false }).limit(45),
      supabaseAdmin.from('donations').select('id', { count: 'exact', head: true })
        .eq('status', 'completed'),
    ]);

    if (topRes.error || recentRes.error) return null;

    const top = mapRecentDonations((topRes.data ?? []) as unknown as RawDonationRow[], 10);
    const recent = mapRecentDonations((recentRes.data ?? []) as unknown as RawDonationRow[], 15);

    return {
      top,
      recent,
      totalDonors: countRes.error ? null : countRes.count ?? 0,
      // Summed from the rows actually fetched, so it is a figure about THIS
      // page's list rather than a platform total it cannot substantiate.
      totalRaisedCents: top.reduce((s, d) => s + d.amountCents, 0),
    };
  } catch {
    return null;
  }
}

function DonorRow({ d, rank }: { d: RecentDonation; rank?: number }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        border: '1px solid var(--b1)',
        borderRadius: 'var(--rl)',
        background: 'var(--s1)',
      }}
    >
      {rank !== undefined && (
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--t4)', minWidth: '20px' }}>{rank}</span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--t1)' }}>{d.name}</span>
        <Link href={`/campaigns/${d.campaignSlug}`} style={{ display: 'block', fontSize: '12px', color: 'var(--t3)', textDecoration: 'none' }}>
          {d.campaignTitle}
        </Link>
      </span>
      <span style={{ fontSize: '14px', fontWeight: 750, color: 'var(--green-text)', whiteSpace: 'nowrap' }}>
        {formatCents(d.amountCents, 'usd')}
      </span>
    </li>
  );
}

export default async function DonorWallPage() {
  const data = await getWall();
  const dash = '—';

  return (
    <PageBody>
      <PageHero
        eyebrow="HALL OF THANKS"
        title="Thank you to our supporters"
        lede="Every gift here funded something real. Donors who gave anonymously, or who keep their profile private, appear as “Anonymous” — that choice is always respected."
      />

      {data === null ? (
        <EmptyState
          icon="⚠️"
          title="We couldn't load the donor wall just now"
          body="This is a problem on our side, not an empty wall. Please refresh in a moment."
          action={<Link href="/donor-wall" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
        />
      ) : (
        <>
          <Section id="stats" heading="Giving so far" intro="Counted from completed donations.">
            <CardGrid min={200}>
              <StatCard value={data.totalDonors != null ? data.totalDonors.toLocaleString() : dash} label="Donations recorded" />
              <StatCard
                value={data.totalRaisedCents > 0 ? formatCents(data.totalRaisedCents, 'usd') : dash}
                label="Raised by the donors listed here"
              />
              {/* The mockup shows "120+ Countries" and "2.3M+ Lives Impacted".
                  Neither is derivable from anything in the schema, so neither is
                  rendered — an invented statistic on a thank-you page would be
                  the least defensible number on the site. */}
            </CardGrid>
          </Section>

          <Section id="top" heading="Largest gifts" intro="The biggest single donations recorded on the platform.">
            {data.top.length === 0 ? (
              <EmptyState
                icon="🌱"
                title="No donations yet"
                body="Be the first to give, and you will be the first name here."
                action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Browse campaigns</Link>}
              />
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' }}>
                {data.top.map((d, i) => <DonorRow key={d.id} d={d} rank={i + 1} />)}
              </ul>
            )}
          </Section>

          <Section id="recent" heading="Most recent" intro="The latest gifts as they come in.">
            {data.recent.length === 0 ? (
              <EmptyState
                icon="🌱"
                title="No donations yet"
                body="The most recent gifts will appear here as soon as they arrive."
                action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Browse campaigns</Link>}
              />
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' }}>
                {data.recent.map((d) => <DonorRow key={d.id} d={d} />)}
              </ul>
            )}
          </Section>
        </>
      )}

      <CtaBand
        heading="Add your name"
        body="Give to a campaign that matters to you — or give anonymously, which is just as welcome."
        primary={{ label: 'Donate now', href: '/donate' }}
        secondary={{ label: 'Explore causes', href: '/causes' }}
      />
    </PageBody>
  );
}
