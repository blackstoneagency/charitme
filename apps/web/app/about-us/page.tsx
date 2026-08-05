import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';
import CampaignImage from '../../components/CampaignImage';
import { IndexHero, StatStrip, statValue, moneyValue } from '../../components/IndexHero';
import { getCausesIndexData } from '../../lib/causes-index';
import { getAboutPageContent } from '../../lib/about-page';
import { getCoverForCategory } from '../../lib/photo-catalog';
import AboutTeam from './AboutTeam';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'CharitMe is a global crowdfunding and fundraising platform that connects compassionate people with the causes that matter to them.',
  alternates: { canonical: 'https://www.charitme.com/about-us' },
};

/**
 * Dynamic on purpose. Both loaders are failure-safe — the figures fall back to
 * `null` (which renders an em dash, never a zero) and the owner-controlled
 * content falls back to its defaults — so a database problem degrades this page
 * rather than failing the Vercel build.
 */
export const dynamic = 'force-dynamic';

/** The reference's four values. Editorial: a value is a claim we make, not a row we count. */
const VALUES = [
  {
    icon: 'shield',
    title: 'Trust & Transparency',
    body: 'We operate with honesty, accountability and openness in everything we do.',
    href: '/verification',
  },
  {
    icon: 'heart',
    title: 'Compassion',
    body: 'We lead with empathy and put people and communities first.',
    href: '/success-stories',
  },
  {
    icon: 'users',
    title: 'Empowerment',
    body: 'We give individuals the tools to take action and make a meaningful impact.',
    href: '/how-it-works',
  },
  {
    icon: 'globe',
    title: 'Inclusion',
    body: 'We welcome everyone and believe in equal opportunity to make a difference.',
    href: '/causes',
  },
] as const;

export default async function AboutUsPage() {
  // Independent reads, so they run together rather than in series.
  const [platform, content] = await Promise.all([getCausesIndexData(), getAboutPageContent()]);
  const { companyName } = content;

  return (
    <div className="ab-page">
      <IndexHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'About Us' }]}
        title={`About ${companyName}`}
        heart
        lede={`We believe every person has the power to create a better tomorrow. ${companyName} is a global crowdfunding and fundraising platform that connects compassionate people with the causes that matter.`}
        photo={getCoverForCategory('Family')}
        photoCategory="Family"
        photoKey="about-us"
        actions={
          // The reference's "Watch Our Story" control. Rendered ONLY when an
          // administrator has set a real URL: a play button that plays nothing
          // is a dead affordance, and this page has no video of its own.
          content.storyVideoUrl ? (
            <a href={content.storyVideoUrl} className="ab-watch" target="_blank" rel="noreferrer">
              <span className="ab-watch-ic" aria-hidden="true">
                <PublicIcon name="play" />
              </span>
              Watch our story
            </a>
          ) : undefined
        }
      />

      <div className="container ab-main">
        {/* ── Our Mission / Our Values ─────────────────────────────────────── */}
        <section className="ab-mission-band" aria-labelledby="ab-mission">
          <div className="ab-mission">
            <h2 id="ab-mission" className="ab-h2 ab-h2--left">Our Mission</h2>
            <span className="ab-mission-ic" aria-hidden="true"><PublicIcon name="heart" /></span>
            <p>
              To empower individuals and communities to raise funds, create change, and build a
              better world — together.
            </p>
          </div>

          <div className="ab-values">
            <h2 id="ab-values" className="ab-h2 ab-h2--left">Our Values</h2>
            <ul className="ab-values-grid" aria-labelledby="ab-values">
              {VALUES.map((value, i) => (
                <li key={value.title}>
                  {/* Each value links to the page that demonstrates it, so the
                      block is navigation rather than four paragraphs of claim. */}
                  <Link href={value.href} className="ab-value">
                    <span className={`ab-value-ic ab-value-ic--${i}`} aria-hidden="true">
                      <PublicIcon name={value.icon} />
                    </span>
                    <strong>{value.title}</strong>
                    <span>{value.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Our Impact So Far ────────────────────────────────────────────
            Every tile MEASURED, from the same loader /causes, /campaigns and
            /how-it-works use — so the four surfaces cannot quote different
            numbers for the same thing.

            ⚠️ The reference asserts "2.3M+ People Helped", "68K+ Lives
            Transformed", "1,250+ Programs Funded", "120+ Countries Reached"
            and "98% Funds to Programs". Not one is an entity in this schema:
            campaigns, donations and supported countries are. Those figures are
            not reproduced.

            The fifth tile IS real and is the strongest number on the page:
            PLATFORM_FEE_PERCENT is 0, so 100% of a donation reaches the
            fundraiser. It is stated as a product fact and linked to /fees,
            which shows the arithmetic. */}
        <section className="ab-impact" aria-labelledby="ab-impact-h">
          <h2 id="ab-impact-h" className="ab-h2">Our Impact So Far</h2>
          <StatStrip
            label={`${companyName} at a glance`}
            tiles={[
              { value: statValue(platform.activeCampaigns), label: 'Active campaigns' },
              { value: moneyValue(platform.raisedTotalCents), label: 'Raised on CharitMe' },
              { value: statValue(platform.gifts), label: 'Gifts given' },
              { value: statValue(platform.countries), label: 'Countries supported' },
              { value: '100%', label: 'Of your gift to the cause' },
            ]}
          />
          <p className="ab-impact-note">
            Zero platform fee — <Link href="/fees">see exactly how the money moves</Link>.
          </p>
        </section>

        {/* ── Our Story ────────────────────────────────────────────────────── */}
        <section className="ab-story" aria-labelledby="ab-story-h">
          <div className="ab-story-copy">
            <h2 id="ab-story-h" className="ab-h2 ab-h2--left">Our Story</h2>
            <p>
              {companyName} was founded with a simple idea: giving should be easy, transparent and
              accessible to all.
            </p>
            <p>
              We saw how many incredible causes struggle to get the support they deserve. So we
              built a platform that removes the barriers, builds trust, and puts the power of change
              in your hands.
            </p>
            <p>
              Today, {companyName} is a global community of changemakers who believe that together,
              we can solve the world&apos;s biggest challenges.
            </p>
            <Link href="/impact" className="ab-story-cta">Learn More About Our Impact →</Link>
          </div>
          <div className="ab-story-media" aria-hidden="true">
            <CampaignImage
              src={getCoverForCategory('Community')}
              category="Community"
              campaignKey="about-story"
              alt=""
              width={560}
              height={380}
            />
          </div>
        </section>

        {/* Renders nothing until an administrator enters a real roster. See
            lib/about-page.ts for why no names are shipped in code. */}
        <AboutTeam members={content.team} />

        {/* ── Be Part of Our Mission ───────────────────────────────────────── */}
        <section className="ab-cta" aria-labelledby="ab-cta-h">
          <span className="ab-cta-ic" aria-hidden="true"><PublicIcon name="heart" /></span>
          <div>
            <h2 id="ab-cta-h">Be Part of Our Mission</h2>
            <p>Together, we can create a world where everyone has hope and every dream has a chance.</p>
          </div>
          <div className="ab-cta-actions">
            <Link href="/causes" className="cx-btn-secondary ab-cta-secondary">Explore causes</Link>
            <Link href="/create/choose-path" className="cta-primary" style={{ display: 'inline-flex' }}>
              Start a fundraiser
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
