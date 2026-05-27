import Link from 'next/link';
import Image from 'next/image';
import type React from 'react';
import { supabaseAdmin } from '../lib/supabase';

export const dynamic = 'force-dynamic';

const FEATURES = [
  { icon: 'edit', title: 'AI Campaign Builder', body: 'Create a powerful campaign in minutes with our AI assistant.', tone: 'violet' },
  { icon: 'rocket', title: 'AI Growth Engine', body: 'Our AI finds your ideal donors and grows your campaign automatically.', tone: 'green' },
  { icon: 'shield', title: 'AI Trust & Safety', body: 'Advanced verification protects donors and builds trust from day one.', tone: 'blue' },
  { icon: 'chart', title: 'AI Optimization', body: 'Real-time insights and AI recommendations to maximize your results.', tone: 'orange' },
  { icon: 'heart', title: 'AI Impact Updates', body: 'Automatically share updates and show donors the real world impact.', tone: 'pink' },
];

const PRESS = ['Forbes', 'FAST COMPANY', 'TC TechCrunch', 'The New York Times', 'USA TODAY'];
const STORY_FILTERS = [
  { label: 'All Stories', value: '', icon: 'grid' },
  { label: 'Individuals', value: 'individuals', icon: 'user' },
  { label: 'Nonprofits', value: 'nonprofits', icon: 'building' },
  { label: 'Communities', value: 'community', icon: 'users' },
  { label: 'Emergencies', value: 'emergency', icon: 'bell' },
];
const STORY_SORTS = [
  { label: 'Latest', value: 'latest' },
  { label: 'Most Raised', value: 'raised' },
  { label: 'Most Donors', value: 'donors' },
];

type HeroCampaign = {
  slug: string;
  title: string;
  tagline?: string | null;
  description?: string | null;
  category: string | null;
  cover_image_url: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  trust_status?: string;
  campaign_health_score?: number;
  deadline: string | null;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
};

type StoryFilters = {
  storyCategory?: string;
  storyQ?: string;
  storySort?: string;
};

function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function shortCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function profileName(value: HeroCampaign['profiles']): string {
  const profile = Array.isArray(value) ? value[0] : value;
  return profile?.full_name ?? 'KindFund Organizer';
}

function storyHref(filters: StoryFilters, updates: StoryFilters): string {
  const params = new URLSearchParams();
  const next = { ...filters, ...updates };
  if (next.storyCategory) params.set('storyCategory', next.storyCategory);
  if (next.storyQ) params.set('storyQ', next.storyQ);
  if (next.storySort && next.storySort !== 'latest') params.set('storySort', next.storySort);
  const query = params.toString();
  return query ? `/?${query}#stories` : '/#stories';
}

function storyImage(campaign: HeroCampaign): string | null {
  return campaign.cover_image_url || null;
}

function storyTone(category: string | null): string {
  const value = (category ?? '').toLowerCase();
  if (value.includes('medical') || value.includes('health') || value.includes('emergency')) return 'medical';
  if (value.includes('education') || value.includes('school')) return 'education';
  if (value.includes('animal') || value.includes('pet')) return 'animal';
  return 'community';
}

async function getHomeData(filters: StoryFilters): Promise<{
  stats: string[][];
  heroCampaign: HeroCampaign | null;
  featuredCampaigns: HeroCampaign[];
  carouselCampaigns: HeroCampaign[];
  heroPercent: number;
  daysLeft: number;
}> {
  const storyCategory = filters.storyCategory?.trim();
  const storyQ = filters.storyQ?.replace(/[,%()]/g, ' ').trim();
  const storySort = filters.storySort === 'raised' || filters.storySort === 'donors' ? filters.storySort : 'latest';
  let carouselQuery = supabaseAdmin
    .from('campaigns')
    .select('slug,title,tagline,category,cover_image_url,goal_amount,raised_amount,backer_count,deadline,status')
    .eq('status', 'active');

  if (storyCategory) {
    carouselQuery = carouselQuery.ilike('category', `%${storyCategory}%`);
  }
  if (storyQ) {
    carouselQuery = carouselQuery.or(`title.ilike.%${storyQ}%,description.ilike.%${storyQ}%,category.ilike.%${storyQ}%`);
  }
  if (storySort === 'raised') {
    carouselQuery = carouselQuery.order('raised_amount', { ascending: false });
  } else if (storySort === 'donors') {
    carouselQuery = carouselQuery.order('backer_count', { ascending: false });
  } else {
    carouselQuery = carouselQuery.order('raised_amount', { ascending: false });
  }

  const [
    { data: campaigns },
    { data: carouselCampaigns },
    { count: campaignCount },
    { count: donationCount },
    { data: trustScores },
  ] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select('slug,title,description,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,profiles:user_id(full_name)')
      .eq('status', 'active')
      .order('raised_amount', { ascending: false })
      .limit(3),
    carouselQuery.limit(8),
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('donations').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabaseAdmin.from('trust_scores').select('score').limit(1000),
  ]);

  const featuredCampaigns = (campaigns ?? []) as HeroCampaign[];
  const heroCampaign = featuredCampaigns[0] ?? null;
  const raisedTotal = heroCampaign?.raised_amount ?? 0;
  const goalTotal = heroCampaign?.goal_amount ?? 1;
  const trustAverage = (trustScores ?? []).length > 0
    ? Math.round((trustScores ?? []).reduce((sum, row) => sum + ((row as { score: number }).score ?? 0), 0) / (trustScores ?? []).length)
    : 0;
  const daysLeft = heroCampaign?.deadline
    ? Math.max(0, Math.ceil((new Date(heroCampaign.deadline).getTime() - Date.now()) / 86_400_000))
    : 0;

  return {
    heroCampaign,
    featuredCampaigns,
    carouselCampaigns: (carouselCampaigns ?? []) as HeroCampaign[],
    heroPercent: Math.min(100, Math.round((raisedTotal / goalTotal) * 100)),
    daysLeft,
    stats: [
      [formatCents(raisedTotal), 'Raised on KindFund'],
      [(campaignCount ?? 0).toLocaleString(), 'Active Campaigns'],
      [shortCount(donationCount ?? 0), 'Donations Recorded'],
      [`${trustAverage}%`, 'Trust Score Average'],
      ['Live', 'Supabase Powered'],
    ],
  };
}

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
  const activeSort = filters.storySort === 'raised' || filters.storySort === 'donors' ? filters.storySort : 'latest';
  const { stats, heroCampaign, featuredCampaigns, carouselCampaigns, heroPercent, daysLeft } = await getHomeData(filters);
  const heroTitle = heroCampaign?.title ?? 'Start a trusted campaign on KindFund';
  const heroHref = heroCampaign ? `/campaigns/${heroCampaign.slug}` : '/campaigns';

  return (
    <div className="kind-page">
      <section className="kind-hero">
        <div className="container kind-hero-grid">
          <div className="kind-hero-copy">
            <div className="kind-badge"><Icon name="sparkle" className="h-4 w-4" /> The World&apos;s #1 AI Fundraising Platform</div>
            <h1>
              Fundraising that <span>thinks</span> for you.
            </h1>
            <div className="kind-scribble" aria-hidden="true" />
            <p>Create, grow, and succeed with the power of AI.<br />More trust. More donors. More impact.</p>
            <div className="kind-actions">
              <Link href="/create" className="kind-btn kind-btn-primary">Start Your Fundraiser</Link>
              <Link href="/how-it-works" className="kind-btn kind-btn-secondary">See How It Works <span><Icon name="play" className="h-3.5 w-3.5" /></span></Link>
            </div>
            <div className="kind-pills">
              {['AI Campaign Builder', 'AI Growth Engine', 'AI Trust & Safety', '24/7 AI Support'].map((item, index) => (
                <div key={item}><Icon name={index === 0 ? 'sparkle' : index === 1 ? 'rocket' : index === 2 ? 'shield' : 'users'} className="h-3.5 w-3.5" />{item}</div>
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

          <div className="kind-hero-art">
            <div className="kind-photo" />
            <div className="kind-floating kind-floating-1"><Icon name="shield" /><div><span>Trust Score</span><strong>{heroCampaign?.campaign_health_score ?? 0}</strong><small>{heroCampaign?.trust_status ?? 'Live'}</small></div></div>
            <div className="kind-floating kind-floating-2"><Icon name="users" /><div><strong>{heroCampaign?.backer_count ?? 0}</strong><span>Donors</span></div></div>
            <div className="kind-floating kind-floating-3"><Icon name="chart" /><div><strong>{heroPercent}%</strong><span>Funded</span></div></div>
            <div className="kind-floating kind-floating-4"><Icon name="clock" /><div><strong>Real-time</strong><span>Impact Updates</span></div></div>
            <div className="kind-campaign-card">
              <div className="kind-verified"><Icon name="check" className="h-3.5 w-3.5" /> VERIFIED CAMPAIGN</div>
              <h2>{heroTitle}</h2>
              <p>Organized by {profileName(heroCampaign?.profiles ?? null)} <b /></p>
              <div className="kind-raise-row"><strong>{formatCents(heroCampaign?.raised_amount ?? 0)} <span>raised</span></strong><span>{formatCents(heroCampaign?.goal_amount ?? 0)} goal</span></div>
              <div className="kind-progress"><i style={{ width: `${heroPercent}%` }} /></div>
              <div className="kind-raise-row kind-small"><span>{heroCampaign?.backer_count ?? 0} donations</span><span>{daysLeft} days left</span></div>
              <Link href={heroHref} className="kind-donate"><Icon name="heart" className="h-4 w-4" /> Donate Now</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="kind-section kind-ai">
        <div className="container">
          <h2>AI Works. You Win.</h2>
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

      <section id="stories" className="container kind-story-carousel">
        <div className="kind-story-toolbar">
          <span>Filter by</span>
          <div className="kind-story-filters">
            {STORY_FILTERS.map((filter) => {
              const active = (filters.storyCategory ?? '') === filter.value;
              return (
                <Link className={active ? 'active' : ''} href={storyHref(filters, { storyCategory: filter.value })} key={filter.label}>
                  <Icon name={filter.icon} className="h-4 w-4" />
                  {filter.label}
                </Link>
              );
            })}
          </div>
          <form action="/" className="kind-story-search">
            {filters.storyCategory && <input type="hidden" name="storyCategory" value={filters.storyCategory} />}
            {activeSort !== 'latest' && <input type="hidden" name="storySort" value={activeSort} />}
            <Icon name="search" className="h-4 w-4" />
            <input name="storyQ" defaultValue={filters.storyQ ?? ''} placeholder="Search stories..." />
            <button type="submit" aria-label="Search stories"><Icon name="search" className="h-4 w-4" /></button>
          </form>
          <form action="/" className="kind-story-sort">
            {filters.storyCategory && <input type="hidden" name="storyCategory" value={filters.storyCategory} />}
            {filters.storyQ && <input type="hidden" name="storyQ" value={filters.storyQ} />}
            <label htmlFor="storySort">Sort by:</label>
            <select id="storySort" name="storySort" defaultValue={activeSort}>
              {STORY_SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
            </select>
            <button type="submit">Apply</button>
          </form>
        </div>
        <div className="kind-story-track" aria-label="Live campaign stories">
          {carouselCampaigns.map((campaign) => {
            const image = storyImage(campaign);
            return (
              <article className="kind-story-card" key={campaign.slug}>
                <Link className={`kind-story-media ${storyTone(campaign.category)}`} href={`/campaigns/${campaign.slug}`}>
                  {image && <Image src={image} alt="" fill sizes="(max-width: 760px) 88vw, (max-width: 1020px) 48vw, 25vw" />}
                  <span>{campaign.category ?? 'Campaign'}</span>
                  <em><Icon name="shield" className="h-3.5 w-3.5" /> Verified</em>
                  <i><Icon name="heart" className="h-6 w-6" /></i>
                </Link>
                <div className="kind-story-body">
                  <h2><Link href={`/campaigns/${campaign.slug}`}>{campaign.title}</Link></h2>
                  <p>{campaign.description ?? campaign.tagline ?? 'Follow this campaign story and its verified fundraising progress.'}</p>
                  <div className="kind-story-meta">
                    <span><Icon name="users" className="h-4 w-4" /><b>{campaign.backer_count.toLocaleString()}</b><small>Donors</small></span>
                    <span><Icon name="dollar" className="h-4 w-4" /><b>{formatCents(campaign.raised_amount)}</b><small>Raised</small></span>
                    <span><Icon name="calendar" className="h-4 w-4" /><b>{campaign.deadline ? new Date(campaign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Live now'}</b></span>
                  </div>
                </div>
              </article>
            );
          })}
          {carouselCampaigns.length === 0 && (
            <article className="kind-story-card empty">
              <div className="kind-story-media community"><span>Live Data</span></div>
              <div className="kind-story-body">
                <h2>No matching stories yet</h2>
                <p>Campaign stories will appear here as soon as matching Supabase campaign records are available.</p>
              </div>
            </article>
          )}
        </div>
      </section>

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
                <p>{item.description ?? `${item.title} is collecting support through verified KindFund records.`}</p>
                <div className="kind-person">
                  <i style={{ background: ['linear-gradient(135deg, #8b5cf6, #f59e0b)', 'linear-gradient(135deg, #10b981, #f472b6)', 'linear-gradient(135deg, #0f172a, #06b6d4)'][index % 3] }} />
                  <div><strong>{profileName(item.profiles)}</strong><span>{item.title}</span><b>Raised {formatCents(item.raised_amount)}</b></div>
                </div>
              </article>
            ))}
            {featuredCampaigns.length === 0 && (
              <article>
                <div className="kind-quote">&quot;</div>
                <p>Campaign stories will appear here as soon as active campaigns are available in Supabase.</p>
                <div className="kind-person">
                  <i style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }} />
                  <div><strong>KindFund</strong><span>Live Supabase data</span><b>Awaiting campaigns</b></div>
                </div>
              </article>
            )}
          </div>
        </div>
        <div className="container kind-press">
          {PRESS.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className="container kind-future">
        <div className="kind-future-bg" />
        <div className="kind-future-copy">
          <h2>The future of fundraising<br />is intelligent.</h2>
          <p>KindFund&apos;s AI works behind the scenes so you can focus on what matters most - your mission.</p>
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
          <h2>Ready to turn your story into impact?</h2>
          <p>Join millions of fundraisers who are reaching their goals with AI.</p>
        </div>
        <div>
          <Link href="/create" className="kind-btn kind-btn-white">Start Your Fundraiser</Link>
          <Link href="/contact" className="kind-btn kind-btn-outline">Talk to an Expert</Link>
        </div>
      </section>
    </div>
  );
}
