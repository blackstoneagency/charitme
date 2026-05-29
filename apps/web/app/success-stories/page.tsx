import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';
import { supabaseAdmin } from '../../lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Success Stories',
  description: 'Real CharitMe success stories from fundraisers and communities creating impact.',
};

const filters = ['All Stories', 'Individuals', 'Nonprofits', 'Communities', 'Emergencies'];

type StoryCampaign = {
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  raised_amount: number;
  backer_count: number;
  created_at: string;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function shortCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function storyImage(category: string | null): string {
  const value = (category ?? '').toLowerCase();
  if (value.includes('medical')) return 'medical';
  if (value.includes('education')) return 'student';
  if (value.includes('animal')) return 'dog';
  return 'community';
}

async function getStoryData() {
  const [{ data: campaigns }, { count: campaignCount }, { count: donationCount }] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select('slug,title,description,category,raised_amount,backer_count,created_at')
      .in('status', ['active', 'completed'])
      .order('raised_amount', { ascending: false })
      .limit(8),
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).in('status', ['active', 'completed']),
    supabaseAdmin.from('donations').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
  ]);

  const stories = (campaigns ?? []) as StoryCampaign[];
  const totalRaised = stories.reduce((sum, story) => sum + story.raised_amount, 0);
  const totalDonors = stories.reduce((sum, story) => sum + story.backer_count, 0);

  return { stories, campaignCount: campaignCount ?? 0, donationCount: donationCount ?? 0, totalRaised, totalDonors };
}

export default async function SuccessStoriesPage() {
  const { stories, campaignCount, donationCount, totalRaised, totalDonors } = await getStoryData();

  return (
    <div className="pub-page">
      <section className="stories-hero">
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Success Stories</b></div>
        <div className="stories-hero-grid">
          <div>
            <h1>Real people. Real stories. Real <em>impact.</em></h1>
            <p>See how individuals, nonprofits and communities achieved their goals with CharitMe.</p>
            <div className="pub-actions">
              <Link href="/login?mode=signup" className="pub-btn primary">Share Your Story <PublicIcon name="edit" /></Link>
              <a href="#stories" className="pub-btn secondary">Browse All Stories <PublicIcon name="arrow" /></a>
            </div>
          </div>
          <div className="stories-collage">
            <div className="story-photo cheering" />
            <div className="story-photo donation" />
            <div className="story-message">Together,<br />we create <em>change.</em></div>
            <div className="story-stats">
              <Stat icon="users" value={campaignCount.toLocaleString()} label="Campaigns Tracked" />
              <Stat icon="dollar" value={formatCents(totalRaised)} label="Raised" />
              <Stat icon="heart" value={shortCount(donationCount)} label="Donations" />
              <Stat icon="globe" value={shortCount(totalDonors)} label="Supporters" />
            </div>
          </div>
        </div>
      </section>

      <section id="stories" className="story-browser">
        <div className="story-filters">
          <span>Filter by</span>
          {filters.map((filter, index) => <button className={index === 0 ? 'active' : ''} key={filter}><PublicIcon name={index === 0 ? 'ai' : index === 1 ? 'users' : index === 2 ? 'tag' : index === 3 ? 'globe' : 'shield'} /> {filter}</button>)}
          <label><PublicIcon name="search" /><input placeholder="Search stories..." /></label>
          <select defaultValue="Latest"><option>Latest</option><option>Most Raised</option></select>
        </div>
        <div className="story-grid">
          {stories.map((story) => (
            <article className="story-card" key={story.slug}>
              <div className={`story-card-img ${storyImage(story.category)}`}><span>{story.category ?? 'Campaign'}</span><Link href={`/campaigns/${story.slug}`} aria-label="View story"><PublicIcon name="heart" /></Link></div>
              <h2>{story.title}</h2>
              <p>{story.description ?? 'This campaign is tracking verified support through CharitMe.'}</p>
              <div className="story-meta">
                <span><PublicIcon name="users" /><b>{story.backer_count.toLocaleString()}</b><small>Donors</small></span>
                <span><PublicIcon name="dollar" /><b>{formatCents(story.raised_amount)}</b><small>Raised</small></span>
                <span><PublicIcon name="calendar" /><b>{new Date(story.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</b></span>
              </div>
            </article>
          ))}
          {stories.length === 0 && (
            <article className="story-card">
              <div className="story-card-img community"><span>Live Data</span></div>
              <h2>No published stories yet</h2>
              <p>Campaign success stories will appear here as soon as Supabase has active or completed campaigns.</p>
            </article>
          )}
        </div>
      </section>

      <section className="story-bottom">
        <div className="story-quotes">
          <h2>What our fundraisers say</h2>
          {(stories.length > 0 ? stories.slice(0, 3) : []).map((story) => (
            <article key={story.slug}><span>&quot;</span><p>{story.description ?? `${story.title} is building momentum with live campaign data.`}</p><b>- {story.title}</b></article>
          ))}
          {stories.length === 0 && <article><span>&quot;</span><p>Fundraiser quotes will populate from live campaign records.</p><b>- CharitMe</b></article>}
        </div>
        <div className="community-impact">
          <h2>Our Community Impact</h2>
          <Stat icon="heart" value={shortCount(campaignCount)} label="Stories Shared" />
          <Stat icon="users" value={shortCount(totalDonors)} label="Supporters" />
          <Stat icon="dollar" value={formatCents(totalRaised)} label="Raised Together" />
          <Stat icon="globe" value={shortCount(donationCount)} label="Donations Recorded" />
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return <article><span><PublicIcon name={icon} /></span><b>{value}</b><small>{label}</small></article>;
}
