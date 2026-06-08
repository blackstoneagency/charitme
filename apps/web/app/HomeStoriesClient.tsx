'use client';

import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { useMemo, useState, useTransition } from 'react';
import { STORY_FILTERS, STORY_SORTS } from '../lib/home-story-options';
import type { HomeCampaign, StoryFilterValue, StoryFilters, StorySortValue } from '../lib/home-types';

function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function storyTone(category: string | null): string {
  const value = (category ?? '').toLowerCase();
  if (value.includes('medical') || value.includes('health') || value.includes('emergency')) return 'medical';
  if (value.includes('education') || value.includes('school')) return 'education';
  if (value.includes('animal') || value.includes('pet')) return 'animal';
  return 'community';
}

function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    building: <><path d="M4 21V5a2 2 0 0 1 2-2h8v18" /><path d="M14 8h4a2 2 0 0 1 2 2v11" /><path d="M8 7h2M8 11h2M8 15h2M17 13h.01M17 17h.01" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
    calendar: <><path d="M8 2v4M16 2v4" /><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /></>,
    dollar: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function normalizeInitialFilters(filters: StoryFilters): { storyCategory: StoryFilterValue; storyQ: string; storySort: StorySortValue } {
  const storyCategory = filters.storyCategory === 'individuals' ||
    filters.storyCategory === 'nonprofits' ||
    filters.storyCategory === 'community' ||
    filters.storyCategory === 'emergency'
    ? filters.storyCategory
    : '';
  const storySort = filters.storySort === 'raised' || filters.storySort === 'donors' ? filters.storySort : 'latest';
  return {
    storyCategory,
    storyQ: typeof filters.storyQ === 'string' ? filters.storyQ : '',
    storySort,
  };
}

type Props = {
  initialCampaigns: HomeCampaign[];
  initialFilters: StoryFilters;
};

export default function HomeStoriesClient({ initialCampaigns, initialFilters }: Props) {
  const normalized = useMemo(() => normalizeInitialFilters(initialFilters), [initialFilters]);
  const [campaigns, setCampaigns] = useState<HomeCampaign[]>(initialCampaigns);
  const [storyCategory, setStoryCategory] = useState<StoryFilterValue>(normalized.storyCategory);
  const [storyQ, setStoryQ] = useState(normalized.storyQ);
  const [storySort, setStorySort] = useState<StorySortValue>(normalized.storySort);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function loadStories(next: { storyCategory?: StoryFilterValue; storyQ?: string; storySort?: StorySortValue }) {
    const filters = {
      storyCategory: next.storyCategory ?? storyCategory,
      storyQ: next.storyQ ?? storyQ,
      storySort: next.storySort ?? storySort,
    };

    startTransition(() => {
      setError('');
      void fetch(`/api/campaigns/stories?${new URLSearchParams(filters).toString()}`, {
        method: 'GET',
        cache: 'no-store',
      })
        .then(async response => {
          const payload = await response.json() as { campaigns?: HomeCampaign[]; error?: string };
          if (!response.ok) throw new Error(payload.error ?? 'Campaign stories could not be loaded.');
          setCampaigns(payload.campaigns ?? []);
        })
        .catch(err => {
          setError(err instanceof Error ? err.message : 'Campaign stories could not be loaded.');
        });
    });
  }

  function chooseCategory(value: StoryFilterValue) {
    setStoryCategory(value);
    loadStories({ storyCategory: value });
  }

  function chooseSort(value: StorySortValue) {
    setStorySort(value);
    loadStories({ storySort: value });
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadStories({ storyQ });
  }

  return (
    <section id="stories" className="container kind-story-carousel" aria-busy={isPending}>
      <div className="kind-story-toolbar">
        <span>Filter by</span>
        <div className="kind-story-filters">
          {STORY_FILTERS.map((filter) => {
            const active = storyCategory === filter.value;
            return (
              <button
                className={active ? 'active' : ''}
                type="button"
                key={filter.label}
                onClick={() => chooseCategory(filter.value)}
              >
                <Icon name={filter.icon} className="h-4 w-4" />
                {filter.label}
              </button>
            );
          })}
        </div>
        <form className="kind-story-search" onSubmit={submitSearch}>
          <Icon name="search" className="h-4 w-4" />
          <input name="storyQ" value={storyQ} onChange={event => setStoryQ(event.target.value)} placeholder="Search stories..." />
          <button type="submit" aria-label="Search stories"><Icon name="search" className="h-4 w-4" /></button>
        </form>
        <div className="kind-story-sort">
          <label htmlFor="storySort">Sort by:</label>
          <select id="storySort" name="storySort" value={storySort} onChange={event => chooseSort(event.target.value as StorySortValue)}>
            {STORY_SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
          </select>
        </div>
      </div>
      <div className={`kind-story-track${isPending ? ' loading' : ''}`} aria-label="Live campaign stories" aria-live="polite">
        {campaigns.map((campaign) => {
          const image = campaign.cover_image_url || null;
          return (
            <article className="kind-story-card" key={campaign.slug}>
              <Link className={`kind-story-media ${storyTone(campaign.category)}`} href={`/campaigns/${campaign.slug}`}>
                {image && <Image src={image} alt="" fill sizes="(max-width: 760px) 88vw, (max-width: 1020px) 48vw, 25vw" />}
                <span>{campaign.category ?? 'Campaign'}</span>
                <em><Icon name="shield" className="h-3.5 w-3.5" /> {campaign.trust_status === 'Verified' ? 'Verified' : 'Trusted'}</em>
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
        {campaigns.length === 0 && (
          <article className="kind-story-card empty">
            <div className="kind-story-media community"><span>Live Data</span></div>
            <div className="kind-story-body">
              <h2>No matching stories yet</h2>
              <p>Campaign stories will appear here as soon as matching Supabase campaign records are available.</p>
            </div>
          </article>
        )}
      </div>
      {error && <p className="kind-story-error">{error}</p>}
    </section>
  );
}
