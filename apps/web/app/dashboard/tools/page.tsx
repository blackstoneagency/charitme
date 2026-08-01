import 'server-only';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { EmptyState } from '../../../components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Fundraising Tools | CharitMe' };

// ─────────────────────────────────────────────────────────────────────────────
// Fundraising Tools hub (design #130).
//
// Every tool listed here already existed — the QR poster, the embeddable widget,
// the share/AI-content panel, the fund ledger, the FAQ builder, the thank-donor
// mailer. They were reachable ONLY from a tab strip inside a single campaign's
// workspace, so a fundraiser had to already know the tool existed, and had to
// pick a campaign before they could find out what CharitMe could do for them.
//
// So this page is a router, not a new feature: it names each tool, says what it
// is for, and links it to a real campaign of the signed-in user's. It reads
// campaigns rather than hardcoding a list of tool links, because a tools page
// whose links 404 for anyone with no campaigns is worse than no tools page.
// ─────────────────────────────────────────────────────────────────────────────

type CampaignRow = { id: string; slug: string; title: string; status: string };

type Tool = {
  key: string;
  label: string;
  desc: string;
  /** Built per campaign — every one of these needs a campaign to act on. */
  href: (c: CampaignRow) => string;
};

const TOOLS: readonly Tool[] = [
  { key: 'widget', label: 'Donation Widget', desc: 'An embeddable donate box for your own website. Configure it, preview it live, copy the code.', href: (c) => `/dashboard/campaigns/${c.id}/widget` },
  { key: 'share', label: 'Share & AI Content', desc: 'Tracked share links plus AI-drafted posts for every channel.', href: (c) => `/dashboard/campaigns/${c.id}/share` },
  { key: 'qr', label: 'QR Poster', desc: 'A printable poster with a QR code straight to your campaign.', href: (c) => `/api/campaigns/${c.id}/qr-poster` },
  { key: 'updates', label: 'Campaign Updates', desc: 'Post progress your donors can follow. Updates are the single strongest driver of repeat giving.', href: (c) => `/dashboard/campaigns/${c.id}/updates` },
  { key: 'thanks', label: 'Thank Your Donors', desc: 'Email everyone who gave, in one pass.', href: (c) => `/dashboard/campaigns/${c.id}/thank-donors` },
  { key: 'ledger', label: 'Transparency Ledger', desc: 'Show donors exactly where the money went.', href: (c) => `/dashboard/campaigns/${c.id}/ledger` },
  { key: 'faqs', label: 'FAQs', desc: 'Answer the questions donors ask before they give.', href: (c) => `/dashboard/campaigns/${c.id}/faqs` },
  { key: 'rewards', label: 'Rewards', desc: 'Offer perks at giving levels.', href: (c) => `/dashboard/campaigns/${c.id}/rewards` },
  { key: 'milestones', label: 'Milestones', desc: 'Break a big goal into stages donors can rally behind.', href: (c) => `/dashboard/campaigns/${c.id}/milestones` },
  { key: 'analytics', label: 'Analytics', desc: 'Where your traffic and donations actually come from.', href: (c) => `/dashboard/campaigns/${c.id}/analytics` },
];

/** `null` means the read FAILED — rendered differently from "no campaigns yet". */
async function loadCampaigns(userId: string): Promise<CampaignRow[] | null> {
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, status')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('[dashboard/tools] campaign read failed', { code: error.code });
    return null;
  }
  return (data ?? []) as CampaignRow[];
}

export default async function FundraisingToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const user = await requireUser();
  const [campaigns, { campaign: requested }] = await Promise.all([
    loadCampaigns(user.id),
    searchParams,
  ]);

  // Prefer an active campaign — the tools are for a campaign that is running.
  const selected =
    campaigns?.find((c) => c.id === requested) ??
    campaigns?.find((c) => c.status === 'active') ??
    campaigns?.[0] ??
    null;

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Fundraising Tools"
        subtitle="Everything CharitMe gives you to raise more, in one place."
      />
      <div style={{ padding: '0 32px 40px' }}>
        {campaigns === null ? (
          <EmptyState
            icon="⚠️"
            title="Tools are unavailable right now"
            body="We could not load your campaigns, so these tools have nothing to point at. Refresh in a moment."
            action={<Link href="/dashboard/tools" style={{ fontWeight: 650, color: 'var(--green-text)' }}>Try again</Link>}
          />
        ) : !selected ? (
          <EmptyState
            icon="🧰"
            title="Create a campaign to unlock these tools"
            body="Every tool here — the widget, the QR poster, the share kit, the ledger — acts on a campaign. Start one and they all turn on."
            action={<Link href="/create" style={{ fontWeight: 650, color: 'var(--green-text)' }}>Start a campaign</Link>}
          />
        ) : (
          <>
            {campaigns.length > 1 && (
              <nav aria-label="Choose a campaign" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {campaigns.map((c) => {
                  const active = c.id === selected.id;
                  return (
                    <Link
                      key={c.id}
                      href={`/dashboard/tools?campaign=${c.id}`}
                      aria-current={active ? 'true' : undefined}
                      style={{
                        fontSize: 13, fontWeight: 600, padding: '7px 12px', borderRadius: 999,
                        textDecoration: 'none',
                        border: `1px solid ${active ? 'var(--brand-text)' : 'var(--b1)'}`,
                        background: active ? 'var(--s2)' : 'transparent',
                        color: active ? 'var(--t1)' : 'var(--t2)',
                      }}
                    >
                      {c.title}
                    </Link>
                  );
                })}
              </nav>
            )}

            <p style={{ fontSize: 13.5, color: 'var(--t3)', margin: '0 0 18px' }}>
              These tools act on <strong style={{ color: 'var(--t1)' }}>{selected.title}</strong>.
            </p>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))', gap: 14 }}>
              {TOOLS.map((tool) => (
                <li key={tool.key} style={{ minWidth: 0 }}>
                  <Link
                    href={tool.href(selected)}
                    style={{
                      display: 'block', height: '100%', padding: 16, minWidth: 0,
                      border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
                      background: 'var(--s1)', textDecoration: 'none',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: 15, color: 'var(--t1)', marginBottom: 5 }}>{tool.label}</strong>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>{tool.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </CharitMeShell>
  );
}
