import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';
import { REFERRAL_TIERS } from '../../lib/referrals';
import { getUser } from '../../lib/auth';

export const metadata: Metadata = {
  title: 'Ambassador Programme',
  description:
    'Share campaigns with your own link and get credited for every donation you inspire. Five recognition tiers, nothing to apply for, and no cut taken out of the cause.',
  alternates: { canonical: 'https://www.charitme.com/ambassadors' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Public face of the referral programme (design #94).
//
// The tiers are read from lib/referrals.ts — the SAME constant the signed-in
// dashboard scores against. A public page holding its own copy of the thresholds
// becomes a promise the product stops keeping the moment either side changes,
// and nobody can see it happen: the page still looks correct. CAMPAIGN_CATEGORIES
// already cost this repo three copies that had drifted apart.
//
// It also says plainly that the reward is RECOGNITION, not commission. There is
// no payout anywhere in getReferralStats and no affiliate cut anywhere in the
// codebase, so a page implying one would recruit people on a false promise — and
// the money it would have to come out of belongs to the campaign.
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    step: '1',
    title: 'Find your link',
    body: 'Open any campaign and look for the "Earn rewards by sharing" box near the donate form. The link inside it is yours.',
  },
  {
    step: '2',
    title: 'Share it',
    body: 'Group chat, email, a post, or in person with a QR code. It works anywhere a link works.',
  },
  {
    step: '3',
    title: 'Donations get credited to you',
    body: 'When someone gives after following your link, it is recorded as a successful referral — against you, and against that campaign.',
  },
  {
    step: '4',
    title: 'Watch the totals',
    body: 'Your dashboard shows links opened, donations completed, and the amount raised through you, per campaign.',
  },
];

export default async function AmbassadorsPage() {
  const user = await getUser();

  return (
    <PageBody>
      <PageHero
        eyebrow="AMBASSADOR PROGRAMME"
        title="Some people are worth a hundred donors"
        lede="Not because they give the most — because they get other people to give. The Ambassador Programme measures that and credits it to you."
        actions={
          <Link
            href={user ? '/dashboard/referrals' : '/login?next=/dashboard/referrals'}
            className="kind-start-pill"
            style={{ display: 'inline-flex' }}
          >
            {user ? 'Open your referral dashboard' : 'Sign in to get your link'}
          </Link>
        }
      />

      <Section id="how" heading="How it works" intro="Four steps, and there is nothing to apply for.">
        <CardGrid>
          {STEPS.map((s) => (
            <InfoCard key={s.step} step={s.step} title={s.title} body={s.body} />
          ))}
        </CardGrid>
      </Section>

      <Section
        id="tiers"
        heading="The tiers"
        intro="Counted on completed donations — not clicks, not sign-ups. No cap, and progress never resets."
      >
        <CardGrid min={220}>
          {REFERRAL_TIERS.map((tier) => (
            <InfoCard key={tier.name} title={`${tier.icon} ${tier.name}`} body={tier.description} />
          ))}
        </CardGrid>
      </Section>

      <Section id="what-you-get" heading="Recognition, not commission">
        <p style={{ maxWidth: 720, fontSize: '15px', lineHeight: 1.7, color: 'var(--t2)' }}>
          Ambassador tiers are a public record of what you have brought in. CharitMe does
          not pay you a percentage of the donations you refer, and we are not going to
          imply otherwise — that money would have to come out of the cause.
        </p>
        <p style={{ maxWidth: 720, fontSize: '15px', lineHeight: 1.7, color: 'var(--t2)' }}>
          What the programme gives you instead is proof. Your tier and totals sit on your
          profile and on the <Link href="/leaderboard">leaderboard</Link>, and they are the
          reason fundraisers, nonprofits and event organisers come looking for the people
          who have them.
        </p>
      </Section>

      <Section id="organisations" heading="For nonprofits and organisers">
        <p style={{ maxWidth: 720, fontSize: '15px', lineHeight: 1.7, color: 'var(--t2)' }}>
          Ambassadors are how a campaign escapes the fundraiser&rsquo;s own address book.
          Referral attribution is per campaign, so you can see who is bringing people in
          and thank them by name. If you are running something larger,{' '}
          <Link href="/teams">team fundraising</Link> and{' '}
          <Link href="/corporate-partnerships">corporate partnerships</Link> are built on
          the same attribution.
        </p>
      </Section>

      <CtaBand
        heading="Your first share is your first tier"
        body="Every account is already in the programme. Get your link and send it to one person."
        primary={{
          label: user ? 'Open your referral dashboard' : 'Sign in to get your link',
          href: user ? '/dashboard/referrals' : '/login?next=/dashboard/referrals',
        }}
        secondary={{ label: 'Browse campaigns to share', href: '/campaigns' }}
      />
    </PageBody>
  );
}
