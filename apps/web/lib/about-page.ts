import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from './supabase';
import { DEFAULTS } from './settings-defaults';

/**
 * The owner-controlled parts of /about-us.
 *
 * ── Why `platform_settings` and not a new table ────────────────────────────
 * The reference design has two blocks this schema cannot otherwise back: a
 * six-person leadership roster ("Our Team") and a "Watch Our Story" button.
 *
 * `team_members` is NOT that roster — it is campaign/nonprofit collaborators,
 * keyed by campaign_id/nonprofit_id, and says nothing about who runs CharitMe.
 * There is no company-leadership table in the schema.
 *
 * A new table was the obvious answer and is the wrong one: **27 migrations are
 * already pending against production** (supabase/RELEASE-RUNBOOK.md), so a
 * table added today would not exist on the live database and the section would
 * be exactly as empty as it is now, with migration debt added.
 *
 * ⚠️ The first attempt used `admin_settings`, and `superseded-tables.test.ts`
 * rejected it by name: `admin_settings` is the untyped key/value PREDECESSOR of
 * `platform_settings`, deliberately left readerless because two config stores
 * is how config drifts. `platform_settings.config` (jsonb, CHECK id = 1) is the
 * live one — the same store the footer, banner and every Super Admin setting
 * already use.
 *
 * ── Why nothing is invented ────────────────────────────────────────────────
 * The reference shows six named people with photographs and job titles. Those
 * are claims about real humans on a real company's About page, so the section
 * renders ONLY from a roster an administrator has actually entered, and does
 * not render at all otherwise. Same for the story video: a "Watch Our Story"
 * control that plays nothing is a dead affordance, so the button appears only
 * once a URL is set.
 */

/**
 * First letters of the first two words of a name.
 *
 * Decorative — the full name is rendered beside it in text — but it lives here
 * rather than in the component so it is reachable from a test. The component
 * cannot be imported by one: vitest runs with Next's tsconfig, which sets
 * jsx: "preserve" because Next compiles JSX itself.
 */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export interface TeamMember {
  name: string;
  title: string;
  /** Optional headshot. Absent renders monogram initials rather than a broken image. */
  photo?: string;
}

export interface AboutPageContent {
  /** Never empty — an About page cannot render an em dash as its subject. */
  companyName: string;
  /** Empty until an administrator enters a roster. The section is then omitted. */
  team: TeamMember[];
  /** `null` unless a real video URL is configured. */
  storyVideoUrl: string | null;
}

const FALLBACK: AboutPageContent = {
  companyName: 'CharitMe',
  team: [],
  storyVideoUrl: null,
};

/**
 * Parse the roster.
 *
 * Accepted as either a JSON array or the array already parsed out of jsonb.
 * Anything that is not a usable entry is DROPPED rather than rendered blank — a
 * card with an empty name and a job title under it is worse than one fewer
 * card. Bounded at 12 so a malformed paste cannot render an unbounded list on a
 * public page.
 */
export function parseTeam(raw: unknown): TeamMember[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const out: TeamMember[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    if (!name || !title) continue;
    const photoRaw = typeof r.photo === 'string' ? r.photo.trim() : '';
    // https only. An http headshot would be blocked as mixed content and render
    // as a broken image on a page whose whole job is looking trustworthy.
    const photo = /^https:\/\/\S+$/.test(photoRaw) ? photoRaw : undefined;
    out.push({ name, title, photo });
    if (out.length === 12) break;
  }
  return out;
}

/** Only a real https URL is a video. Anything else leaves the control unrendered. */
export function parseVideoUrl(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return /^https:\/\/\S+$/.test(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Cached like the footer and banner readers: this is public, non-personalised
 * configuration, and an uncached read costs a Supabase round-trip on every
 * request. The `platform-settings` tag is the one the Super Admin settings save
 * already busts, so an edit shows up without waiting out the window.
 */
const fetchAboutContent = unstable_cache(
  async (): Promise<AboutPageContent> => {
    try {
      const { data, error } = await supabaseAdmin
        .from('platform_settings')
        .select('config')
        .eq('id', 1)
        .maybeSingle();

      // supabase-js RESOLVES on a failed query rather than throwing, so the
      // error has to be checked explicitly or `data` is silently null and every
      // field falls back with nothing saying so.
      if (error) return FALLBACK;

      const config = asRecord(data?.config);
      const general = asRecord(config.general);
      const about = asRecord(config.about);

      const name = typeof general.platformName === 'string' ? general.platformName.trim() : '';

      return {
        companyName: name || FALLBACK.companyName,
        team: parseTeam(about.teamRoster ?? DEFAULTS.about.teamRoster),
        storyVideoUrl: parseVideoUrl(about.storyVideoUrl ?? DEFAULTS.about.storyVideoUrl),
      };
    } catch {
      return FALLBACK;
    }
  },
  ['about-page-content'],
  { revalidate: 60, tags: ['about-content', 'platform-settings'] },
);

export async function getAboutPageContent(): Promise<AboutPageContent> {
  return fetchAboutContent();
}
