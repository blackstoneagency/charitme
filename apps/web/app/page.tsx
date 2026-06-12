import Link from 'next/link';
import type React from 'react';
import HeroRotator from './HeroRotator';
import SponsorsBar from './SponsorsBar';
import HomeStoriesClient from './HomeStoriesClient';
import { getHomeData, profileName } from '../lib/home-data';
import { formatMoneyCompact } from '@shared/currencies';
import type { StoryFilters } from '../lib/home-types';

export const dynamic = 'force-dynamic';

const FEATURES = [
  { icon: 'edit', title: 'CharitMe AI Builder', body: 'Write your entire fundraiser in seconds — title, story, goal, and strategy — powered by CharitMe AI.', tone: 'violet' },
  { icon: 'rocket', title: 'AI Growth Engine', body: 'CharitMe AI finds your ideal donors, optimizes your campaign, and grows donations automatically.', tone: 'green' },
  { icon: 'shield', title: 'CharitScore™ Trust', body: 'Our AI-powered trust score gives every campaign a 0–100 CharitScore so donors give with confidence.', tone: 'blue' },
  { icon: 'chart', title: 'AI Optimization', body: 'Real-time AI insights, next-best-action suggestions, and campaign health monitoring 24/7.', tone: 'orange' },
  { icon: 'heart', title: 'AI Donor Relationships', body: 'CharitMe AI writes thank-you notes, updates, and donor messages that feel personal and real.', tone: 'pink' },
];

function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, React.ReactNode> = {
    sparkle: <><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    rocket: <><path d="M4.5 16.5c-1.1 1.1-1.5 3-1.5 3s1.9-.4 3-1.5c.6-.6.7-1.5.2-2.1-.5-.5-1.4-.4-1.7.6Z" /><path d="M9 15l-2-2a16 16 0 0 1 8-9 5 5 0 0 1 5 5 16 16 0 0 1-9 8l-2-2Z" /><path d="M15 9h.01" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    chart: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-7" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    building: <><path d="M4 21V5a2 2 0 0 1 2-2h8v18" /><path d="M14 8h4a2 2 0 0 1 2 2v11" /><path d="M8 7h2M8 11h2M8 15h2M17 13h.01M17 17h.01" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
    calendar: <><path d="M8 2v4M16 2v4" /><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /></>,
    dollar: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    play: <path d="M9 7l8 5-8 5V7Z" />,
    check: <path d="M20 6L9 17l-5-5" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export default async function HomePage({ searchParams }: { searchParams?: Promise<StoryFilters> }) {
  const filters = await searchParams ?? {};
  const { stats, featuredCampaigns, carouselCampaigns, rotatorCampaigns } = await getHomeData(filters);

  const BASE = 'https://www.charitme.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'CharitMe',
        url: BASE,
        logo: `${BASE}/icon.png`,
      },
      {
        '@type': 'WebSite',
        name: 'CharitMe',
        url: BASE,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${BASE}/campaigns?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <div className="kind-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="kind-hero">
        <div className="container kind-hero-grid">
          <div className="kind-hero-copy">
            <div className="kind-badge"><Icon name="sparkle" className="h-4 w-4" /> The AI Fundraising Platform</div>
            <h1>
              Raise More. Faster. <span>With AI.</span>
            </h1>
            <div className="kind-scribble" aria-hidden="true" />
            <p>CharitMe is the world&apos;s first AI-powered fundraising platform that helps people, teams, creators, and nonprofits create trusted campaigns and grow donations.</p>
            <div className="kind-actions">
              <Link href="/ai-campaign" className="kind-btn kind-btn-primary">Create My Fundraiser With AI</Link>
              <Link href="/campaigns" className="kind-btn kind-btn-secondary">Donate Now <span><Icon name="arrow" className="h-3.5 w-3.5" /></span></Link>
            </div>
            <div className="kind-actions" style={{ marginTop: 14 }}>
              <Link href="/create" className="kind-btn kind-btn-secondary">Create My Fundraiser <span><Icon name="arrow" className="h-3.5 w-3.5" /></span></Link>
              <Link href="/features" className="kind-btn kind-btn-secondary">Why We Beat GoFundMe <span><Icon name="arrow" className="h-3.5 w-3.5" /></span></Link>
            </div>
            <div className="kind-pills">
              {['CharitMe AI Builder', 'AI Growth Engine', 'CharitScore Trust', '0% Platform Fees'].map((item, index) => (
                <div key={item}><Icon name={index === 0 ? 'sparkle' : index === 1 ? 'rocket' : index === 2 ? 'shield' : 'gift'} className="h-3.5 w-3.5" />{item}</div>
              ))}
            </div>
            <div className="kind-proof">
              <span>{stats[1][0]} active campaigns</span>
              <div className="kind-avatar-stack">
                {[0, 1, 2, 3, 4].map((i) => <i key={i} />)}
              </div>
              <strong>{stats[2][0]}</strong>
              <span>completed donations tracked</span>
            </div>
          </div>

          <HeroRotator
            campaigns={rotatorCampaigns}
            fallbackImageUrl="/hero-child-crop.png"
          />
        </div>
      </section>

      <section className="kind-section kind-ai">
        <div className="container">
          <h2>Meet CharitMe AI — Your Personal Fundraising Team.</h2>
          <div className="kind-feature-grid">
            {FEATURES.map((feature) => (
              <article className="kind-feature" key={feature.title}>
                <div className={`kind-icon kind-icon-${feature.tone}`}><Icon name={feature.icon} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
                <Link href="/features">Learn more <Icon name="arrow" className="h-3.5 w-3.5" /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container kind-stats">
        {stats.map(([value, label]) => (
          <div key={label}><strong>{value}</strong><span>{label}</span></div>
        ))}
      </section>

      <HomeStoriesClient initialCampaigns={carouselCampaigns} initialFilters={filters} />

      <section className="kind-section kind-trust">
        <div className="container kind-trust-grid">
          <div>
            <span className="kind-eyebrow">More than a platform</span>
            <h2>A movement powered<br />by trust and technology.</h2>
            <p>We combine human compassion with artificial intelligence to help more people succeed and more good happen in the world.</p>
            <ul>
              {['Industry-leading Trust Score', 'Real-time fraud detection', 'Bank-level security', 'Transparent impact tracking'].map((item) => (
                <li key={item}><Icon name="check" className="h-3 w-3" /> {item}</li>
              ))}
            </ul>
            <Link href="/trust-safety">Our Trust Promise <Icon name="arrow" className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="kind-testimonials">
            {featuredCampaigns.map((item, index) => (
              <article key={item.slug}>
                <div className="kind-quote">&quot;</div>
                <p>{item.description ?? `${item.title} is collecting support through verified CharitMe records.`}</p>
                <div className="kind-person">
                  <i style={{ background: ['linear-gradient(135deg, #8b5cf6, #f59e0b)', 'linear-gradient(135deg, #10b981, #f472b6)', 'linear-gradient(135deg, #0f172a, #06b6d4)'][index % 3] }} />
                  <div><strong>{profileName(item.profiles)}</strong><span>{item.title}</span><b>Raised {formatMoneyCompact(item.raised_amount, item.currency ?? 'usd')}</b></div>
                </div>
              </article>
            ))}
            {featuredCampaigns.length === 0 && (
              <article>
                <div className="kind-quote">&quot;</div>
                <p>Be among the first to launch a campaign and inspire the CharitMe community.</p>
                <div className="kind-person">
                  <i style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }} />
                  <div><strong>CharitMe</strong><span>Your story starts here</span><b>Start a campaign</b></div>
                </div>
              </article>
            )}
          </div>
        </div>
        <SponsorsBar />
      </section>

      <section className="container kind-future">
        <div className="kind-future-bg" />
        <div className="kind-future-copy">
          <h2>The future of fundraising<br />is intelligent.</h2>
          <p>CharitMe&apos;s AI works behind the scenes so you can focus on what matters most - your mission.</p>
        </div>
        <div className="kind-orbits">
          {[
            ['sparkle', 'Smarter Campaigns', 'AI creates and optimizes for maximum impact.'],
            ['users', 'Stronger Connections', 'AI matches you with the right supporters.'],
            ['heart', 'Bigger Impact', 'AI helps you change more lives.'],
          ].map(([icon, title, body], i) => (
            <article key={title}>
              <div className={i === 1 ? 'green' : i === 2 ? 'orange' : ''}><Icon name={icon} /></div>
              <strong>{title}</strong>
              <span>{body}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="container kind-cta">
        <div>
          <h2>GoFundMe gives you a page. CharitMe gives you a team.</h2>
          <p>Join thousands of fundraisers raising more, faster, with CharitMe AI.</p>
        </div>
        <div>
          <Link href="/create" className="kind-btn kind-btn-white">Create My Fundraiser With AI</Link>
        </div>
      </section>
    </div>
  );
}
