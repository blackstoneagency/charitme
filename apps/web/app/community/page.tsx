import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { boundedQuery } from '\.\./\.\./lib/query-timeout';
import { campaignColumns } from '../../lib/campaign-visibility';
import { mapRecentDonations, type RawDonationRow } from '../../lib/home-data';
import { formatCents } from '../../lib/stripe';
import { EmptyState } from '../../components/ui';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Community',
  description:
    'What is happening across CharitMe right now — organiser updates from live campaigns and the gifts coming in.',
  alternates: { canonical: 'https://www.charitme.com/community' },
};

export const revalidate = 180;

// ─────────────────────────────────────────────────────────────────────────────
// Design 82 shows a social feed: post composer, trending hashtags, "Who to
// Follow", likes and comments. None of that exists — there is no posts table, no
// follow graph, no hashtags, and no reactions outside a campaign's own comments.
//
// Building the shell anyway would be the worst kind of fake: a composer that
// discards what you type and a "Follow" button that does nothing.
//
// What DOES exist is genuinely a community feed: organisers post
// `campaign_updates`, and donations arrive continuously. So this shows the real
// activity, and says plainly that posting happens on a campaign rather than
// here.
// ─────────────────────────────────────────────────────────────────────────────

interface UpdateRow {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
  campaigns: { title: string; slug: string; visibility?: string | null } | { title: string; slug: string; visibility?: string | null }[] | null;
}

interface Feed {
  updates: { id: string; title: string | null; body: string; createdAt: string; campaignTitle: string; campaignSlug: string }[];
  donations: { id: string; name: string; amountCents: number; campaignTitle: string; campaignSlug: string }[];
}

/** `null` on failure — distinct from a genuinely quiet week. */
async function getFeed(): Promise<Feed | null> {
  try {
    const cols = await campaignColumns();
    const campaignJoin = cols.visibility
      ? 'campaigns:campaign_id(title, slug, visibility)'
      : 'campaigns:campaign_id(title, slug)';

    const [updRes, donRes] = await Promise.all([
      boundedQuery(() =>
        supabaseAdmin
          .from('campaign_updates')
          .select(`id, title, body, created_at, ${campaignJoin}`)
          .order('created_at', { ascending: false })
          .limit(30)
      ),
      boundedQuery(() =>
        supabaseAdmin
          .from('donations')
          .select(`id, amount_cents, anonymous, created_at, offline_donor_name, ${campaignJoin}, profiles:donor_id(full_name, show_public_profile)`)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(30)
      ),
    ]);

    if (updRes.error || donRes.error) return null;

    const updates = ((updRes.data ?? []) as unknown as UpdateRow[])
      .map((u) => {
        const c = Array.isArray(u.campaigns) ? u.campaigns[0] : u.campaigns;
        // Never surface an update belonging to a private campaign — the same
        // rule mapRecentDonations applies to the donation feed.
        if (!c || c.visibility === 'private') return null;
        return {
          id: u.id,
          title: u.title,
          body: u.body,
          createdAt: u.created_at,
          campaignTitle: c.title,
          campaignSlug: c.slug,
        };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .slice(0, 12);

    // Donor names go through the shared transform, which honours BOTH the
    // per-donation anonymous flag and the account-wide profile-visibility
    // setting. A community feed naming someone who asked to be private would be
    // the same leak the homepage ticker once had.
    const donations = mapRecentDonations((donRes.data ?? []) as unknown as RawDonationRow[], 12)
      .map((d) => ({
        id: d.id,
        name: d.name,
        amountCents: d.amountCents,
        campaignTitle: d.campaignTitle,
        campaignSlug: d.campaignSlug,
      }));

    return { updates, donations };
  } catch {
    return null;
  }
}

const WAYS = [
  { title: 'Post an update', body: 'Updates come from campaign organisers. Post one from your campaign and it appears here.', href: '/dashboard/campaigns' },
  { title: 'Leave a message', body: 'Every campaign page takes comments and messages of support.', href: '/campaigns' },
  { title: 'Say thank you', body: 'The donor wall records the gifts people have made.', href: '/donor-wall' },
  { title: 'Share a story', body: 'Completed campaigns become success stories others learn from.', href: '/success-stories' },
];

export default async function CommunityPage() {
  const feed = await getFeed();

  return (
    <PageBody>
      <PageHero
        eyebrow="COMMUNITY"
        title="What is happening right now"
        lede="Organiser updates from live campaigns and the gifts arriving as they happen. Everything here is real activity — nothing is staged."
      />

      {feed === null ? (
        <EmptyState
          icon="⚠️"
          title="We couldn't load the community feed just now"
          body="This is a problem on our side, not a quiet week. Please refresh in a moment."
          action={<Link href="/community" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
        />
      ) : (
        <>
          <Section id="updates" heading="Latest updates" intro="Posted by the people running campaigns.">
            {feed.updates.length === 0 ? (
              <EmptyState
                icon="📣"
                title="No updates posted yet"
                body="Organiser updates appear here as soon as they are published."
                action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Browse campaigns</Link>}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '12px' }}>
                {feed.updates.map((u) => (
                  <article key={u.id} style={{ padding: '18px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)' }}>
                    {u.title && (
                      <h3 style={{ fontSize: '15px', fontWeight: 750, color: 'var(--t1)', marginBottom: '6px' }}>{u.title}</h3>
                    )}
                    <p style={{ fontSize: '14px', color: 'var(--t3)', lineHeight: 1.6, margin: 0 }}>
                      {u.body.slice(0, 260)}{u.body.length > 260 ? '…' : ''}
                    </p>
                    <p style={{ fontSize: '12.5px', color: 'var(--t4)', marginTop: '10px' }}>
                      on{' '}
                      <Link href={`/campaigns/${u.campaignSlug}`} style={{ color: 'var(--green-text)', fontWeight: 650 }}>
                        {u.campaignTitle}
                      </Link>
                    </p>
                  </article>
                ))}
              </div>
            )}
          </Section>

          <Section id="giving" heading="Giving as it happens">
            {feed.donations.length === 0 ? (
              <EmptyState
                icon="🌱"
                title="No donations yet"
                body="Gifts appear here as they arrive."
                action={<Link href="/donate" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Be the first</Link>}
              />
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' }}>
                {feed.donations.map((d) => (
                  <li key={d.id} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: '12px', padding: '11px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '14px', color: 'var(--t1)' }}>
                      <strong style={{ fontWeight: 700 }}>{d.name}</strong>{' '}
                      <span style={{ color: 'var(--t3)' }}>gave to</span>{' '}
                      <Link href={`/campaigns/${d.campaignSlug}`} style={{ color: 'var(--green-text)', fontWeight: 650, textDecoration: 'none' }}>
                        {d.campaignTitle}
                      </Link>
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 750, color: 'var(--green-text)', whiteSpace: 'nowrap' }}>
                      {formatCents(d.amountCents, 'usd')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <Section id="take-part" heading="How to take part">
        <CardGrid min={250}>
          {WAYS.map((w) => <InfoCard key={w.href} title={w.title} body={w.body} href={w.href} />)}
        </CardGrid>
        <p style={{ fontSize: '13px', color: 'var(--t4)', marginTop: '14px', maxWidth: '680px', lineHeight: 1.6 }}>
          There is no post box, follow button or hashtag feed on this page. CharitMe has no posts
          table, no follow graph and no reactions outside a campaign&rsquo;s own comments — a composer
          that discarded what you typed would be worse than not having one. Updates are posted from a
          campaign, and they show up here.
        </p>
      </Section>

      <CtaBand
        heading="Join in"
        body="Support a campaign, or start one and post the first update yourself."
        primary={{ label: 'Browse campaigns', href: '/campaigns' }}
        secondary={{ label: 'Start a fundraiser', href: '/create' }}
      />
    </PageBody>
  );
}
