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
 * A new table was the obvious answer and is the wrong one: migrations are
 * merged well ahead of being applied to production (supabase/RELEASE-RUNBOOK.md),
 * so a table added today would not exist on the live database and the section
 * would be exactly as empty as it is now, with migration debt added.
 *
 * (An earlier version of this comment said "27 pending". That figure is a FILE
 * COUNT rather than a measurement and the runbook now records it as known to be
 * too high — at least four of the 27 are already live. The argument does not
 * depend on the number, so the number is gone rather than restated wrongly.)
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
  /**
   * Optional LinkedIn profile, shown as the small "in" control the reference
   * puts under each face.
   *
   * ⚠️ Validated as ACTUALLY LinkedIn, not merely https. An arbitrary URL behind
   * a LinkedIn icon tells the visitor where they are going and then sends them
   * somewhere else — a small lie, but on the page whose entire job is looking
   * trustworthy, and one an administrator could introduce with a typo.
   */
  linkedin?: string;
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
    const linkedinRaw = typeof r.linkedin === 'string' ? r.linkedin.trim() : '';
    out.push({ name, title, photo, linkedin: parseLinkedIn(linkedinRaw) });
    if (out.length === 12) break;
  }
  return out;
}

/**
 * A LinkedIn profile, or nothing.
 *
 * Host-checked rather than substring-matched: `https://evil.com/linkedin.com`
 * contains the string and is not LinkedIn, and `https://linkedin.com.evil.com`
 * is the classic suffix trick. Parsing the URL and comparing the HOSTNAME is
 * the only form that gets both right.
 */
export function parseLinkedIn(raw: unknown): string | undefined {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return undefined;
  const host = url.hostname.toLowerCase();
  return host === 'linkedin.com' || host.endsWith('.linkedin.com') ? value : undefined;
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
