import 'server-only';
import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { resolveCampaignCover } from '../../../lib/covers';
import { getTranslator } from '../../../lib/locale-server';
import { formatMoneyShort } from '@shared/currencies';
import { EmptyState } from '../../../components/ui';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';

export const metadata: Metadata = { title: 'Saved causes' };
export const dynamic = 'force-dynamic';

type SavedRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  category: string | null;
  cover_image_url: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number | null;
  status: string;
};

/**
 * The signed-in user's saved campaigns.
 *
 * `saved_campaigns` held 240 rows with a working save button and a working
 * /api/saved-campaigns route — and no page. A visitor could save a campaign and
 * then had nowhere to find it again, which makes the heart button a write-only
 * control.
 *
 * Two queries rather than a join: PostgREST embeds would return the campaign
 * nested per save row, and the second query has to filter on visibility and
 * deleted_at anyway. `null` means the read FAILED, which the page renders
 * differently from "you have not saved anything" — those are opposite messages
 * and showing the empty state for a failed query tells someone their saves are
 * gone.
 */
async function getSaved(userId: string): Promise<SavedRow[] | null> {
  // The `error` branches below were already right — `null` for a failed read,
  // never the empty state. But a returned `error` is not the only way this
  // fails: `supabaseAdmin` is a Proxy whose `get` trap THROWS when the env is
  // missing, so `.from(...)` can throw before a query is ever issued, and that
  // escapes an `if (error)` check entirely.
  //
  // That exact gap took the whole site down through the root layout's
  // announcements loader. Same shape here, smaller blast radius: this page
  // would 500 instead of degrading. The catch maps a throw onto the same `null`
  // the error path already returns, so the honest "we couldn't load your saves"
  // message covers both.
  try {
    const { data: saved, error } = await supabaseAdmin
      .from('saved_campaigns')
      .select('campaign_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.warn('[dashboard/saved] save list unavailable', { code: error.code });
      return null;
    }

    const ids = (saved ?? []).map((s) => s.campaign_id as string);
    if (ids.length === 0) return [];

    const { data: campaigns, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, title, tagline, category, cover_image_url, goal_amount, raised_amount, backer_count, status')
      .in('id', ids)
      .neq('visibility', 'private')
      .is('deleted_at', null);
    if (campaignError) {
      console.warn('[dashboard/saved] campaign read failed', { code: campaignError.code });
      return null;
    }

    // Preserve save order — the list is "most recently saved first", and the
    // campaigns query returns whatever order Postgres likes.
    const byId = new Map((campaigns ?? []).map((c) => [c.id as string, c as SavedRow]));
    return ids.map((id) => byId.get(id)).filter((c): c is SavedRow => Boolean(c));
  } catch {
    return null;
  }
}

export default async function SavedCausesPage() {
  const user = await requireUser();
  const [rows, t] = await Promise.all([getSaved(user.id), getTranslator()]);

  const covers = rows
    ? await Promise.all(rows.map((c) => resolveCampaignCover(c.cover_image_url, c.category, c.slug, 'dashboard-saved')))
    : [];

  return (
    <CharitMeShell active="Saved Causes">
      <TopBar title={t('saved.title')} subtitle={t('saved.subtitle')} />
      <div style={{ padding: '4px 0 40px' }}>

      {rows === null ? (
        <EmptyState
          icon="⚠️"
          title={t('saved.failed_title')}
          body={t('saved.failed_body')}
          action={<Link href="/dashboard/saved" style={{ fontWeight: 650, color: 'var(--green-text)' }}>{t('action.retry')}</Link>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="💜"
          title={t('saved.empty_title')}
          body={t('saved.empty_body')}
          action={<Link href="/campaigns" style={{ fontWeight: 650, color: 'var(--green-text)' }}>{t('footer.link.campaigns')}</Link>}
        />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,268px),1fr))', gap: 16 }}>
          {rows.map((c, i) => {
            const pct = c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0;
            const ended = c.status !== 'active';
            return (
              <li key={c.id} style={{ minWidth: 0 }}>
                <Link href={`/campaigns/${c.slug}`} style={{
                  display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0,
                  border: '1px solid var(--b1)', borderRadius: 'var(--rl)', overflow: 'hidden',
                  background: 'var(--s1)', textDecoration: 'none',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={covers[i]} alt="" width={400} height={180} loading="lazy"
                       style={{ width: '100%', height: 136, objectFit: 'cover' }} />
                  <span style={{ padding: 14, display: 'block', minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 15, color: 'var(--t1)', marginBottom: 4 }}>{c.title}</strong>
                    {c.tagline && (
                      <span style={{ display: 'block', fontSize: 13, color: 'var(--t3)', lineHeight: 1.45, marginBottom: 10 }}>{c.tagline}</span>
                    )}
                    <span style={{ display: 'block', height: 6, borderRadius: 999, background: 'var(--s3)', overflow: 'hidden', marginBottom: 6 }}>
                      <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--green)' }} />
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--t2)' }}>
                      <b style={{ color: 'var(--t1)' }}>{formatMoneyShort(c.raised_amount)}</b> {t('campaign.raised')}
                      {/* A saved campaign that has since ended is still worth showing —
                          it is the visitor's own list — but it must say so, rather than
                          inviting a donation that cannot be made. */}
                      {ended && <span style={{ color: 'var(--t3)' }}> · {t('campaign.ended_short')}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </CharitMeShell>
  );
}
