import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';
import { ProgressBar, Card, EmptyState } from '../../components/ui';
import { formatMoneyShort, DEFAULT_CURRENCY } from '@shared/currencies';
import { getCoverForCampaign } from '../../lib/photo-catalog';
import { optimizedCoverUrl } from '../../lib/img-optimize';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Saved Causes | CharitMe' };

// ─────────────────────────────────────────────────────────────────────────────
// Saved causes (design #122).
//
// `saved_campaigns` had a table, RLS, a working GET/POST at
// /api/saved-campaigns, and a save button on every campaign page — and NO
// destination. A visitor could bookmark causes and had nowhere to see them, so
// the feature was write-only: the same "shipped but unreachable" shape as
// creator_profiles and api_keys.
//
// Rendered server-side rather than fetching the existing endpoint from the
// client: this page is behind requireUser() anyway, and a server render means
// the list is present in the first paint instead of after a round-trip.
// ─────────────────────────────────────────────────────────────────────────────

interface SavedCampaign {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  category: string | null;
  cover_image_url: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  status: string;
  saved_at: string;
}

async function getSaved(userId: string): Promise<{ rows: SavedCampaign[]; loadFailed: boolean }> {
  try {
    const { data: saved, error } = await supabaseAdmin
      .from('saved_campaigns')
      .select('campaign_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return { rows: [], loadFailed: true };

    const ids = (saved ?? []).map((s) => s.campaign_id as string);
    if (ids.length === 0) return { rows: [], loadFailed: false };

    const { data: campaigns, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, title, tagline, category, cover_image_url, goal_amount, raised_amount, backer_count, status')
      .in('id', ids)
      // A campaign the owner made private, or deleted, must not resurface here
      // just because someone bookmarked it earlier.
      .neq('visibility', 'private')
      .is('deleted_at', null);

    if (campaignError) return { rows: [], loadFailed: true };

    const savedAt = new Map((saved ?? []).map((s) => [s.campaign_id as string, s.created_at as string]));
    const byId = new Map((campaigns ?? []).map((c) => [c.id as string, c]));

    // Ordered by when they were SAVED, not by campaign field — the list is the
    // user's own history, so the newest bookmark belongs at the top.
    const rows = ids
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({ ...c, saved_at: savedAt.get(c.id) ?? '' })) as SavedCampaign[];

    return { rows, loadFailed: false };
  } catch {
    return { rows: [], loadFailed: true };
  }
}

export default async function SavedPage() {
  const user = await requireUser();
  const { rows, loadFailed } = await getSaved(user.id);

  return (
    <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 64px' }}>
      <header style={{ marginBottom: 26 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--violet-ink)',
            marginBottom: 10,
          }}
        >
          Saved
        </span>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, fontWeight: 900, margin: '0 0 10px', color: 'var(--t1)' }}>
          Your saved causes
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--t2)', margin: 0, maxWidth: 640 }}>
          {rows.length > 0
            ? `${rows.length} ${rows.length === 1 ? 'cause' : 'causes'} you bookmarked, newest first.`
            : 'Causes you bookmark are collected here so you can come back to them.'}
        </p>
      </header>

      {/* An empty list and a failed read look identical to a visitor. Telling
          someone they have saved nothing when the database is unreachable is the
          failure mode this repo keeps recording. */}
      {loadFailed && (
        <div
          role="alert"
          style={{
            border: '1px solid var(--b1)',
            background: 'var(--s2)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 20,
            fontSize: 14,
            color: 'var(--t2)',
          }}
        >
          Your saved causes could not be loaded just now. This is a temporary problem on our side — it
          does not mean your saves are gone. Please try again shortly.
        </div>
      )}

      {!loadFailed && rows.length === 0 && (
        <EmptyState
          title="Nothing saved yet"
          body="Tap the heart on any campaign to save it here for later."
          action={
            <Link href="/campaigns" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
              Browse campaigns →
            </Link>
          }
        />
      )}

      {rows.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: 20,
          }}
        >
          {rows.map((c) => {
            const cover = optimizedCoverUrl(
              c.cover_image_url ?? getCoverForCampaign(c.category ?? 'Community', c.id),
              600,
            );
            const ended = c.status !== 'active';
            return (
              <li key={c.id}>
                <Card style={{ padding: 0, overflow: 'hidden', height: '100%' }}>
                  <Link href={`/campaigns/${c.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{ padding: 16 }}>
                      <h2
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          margin: '0 0 6px',
                          color: 'var(--t1)',
                          lineHeight: 1.35,
                        }}
                      >
                        {c.title}
                      </h2>
                      {/* Said plainly rather than hidden: a saved campaign that
                          has closed is still worth showing — the visitor chose
                          to follow it — but they should not click through
                          expecting to give. */}
                      {ended && (
                        <p style={{ fontSize: 12, color: 'var(--t3)', margin: '0 0 8px', fontWeight: 700 }}>
                          No longer accepting donations
                        </p>
                      )}
                      <ProgressBar value={c.raised_amount} max={c.goal_amount > 0 ? c.goal_amount : 1} />
                      <p style={{ fontSize: 13, color: 'var(--t2)', margin: '8px 0 0' }}>
                        <strong style={{ color: 'var(--t1)' }}>
                          {formatMoneyShort(c.raised_amount, DEFAULT_CURRENCY)}
                        </strong>{' '}
                        raised
                        {c.backer_count > 0 &&
                          ` · ${c.backer_count} donor${c.backer_count === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
