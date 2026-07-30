'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Btn, Input, Textarea, Select, Card, Badge, EmptyState } from '../../../../components/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Creator page + membership tiers, in one screen.
//
// Split into two forms because the second one cannot work until the first has
// been saved: tiers hang off `creator_profile_id`, so POST /api/creators/tiers
// answers 409 NO_CREATOR_PROFILE until a profile exists. Rather than let the
// user fill in a tier and then be told that, the tier section states the
// dependency up front and does not render a form.
// ─────────────────────────────────────────────────────────────────────────────

export type CreatorProfile = {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  hero_image_url: string | null;
  website_url: string | null;
  brand_color: string | null;
  accepts_tips: boolean;
  accepts_commissions: boolean;
};

export type Tier = {
  id: string;
  title: string;
  description: string;
  amount_cents: number;
  interval: 'month' | 'year';
  benefits: string[];
  active: boolean;
};

export type Post = {
  id: string;
  title: string;
  body: string;
  visibility: 'public' | 'members' | 'tier';
  minimum_tier_id: string | null;
  created_at: string;
};

interface Props {
  initialProfile: CreatorProfile | null;
  initialTiers: Tier[];
  initialPosts: Post[];
}

const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 });

export function CreatorClient({ initialProfile, initialTiers, initialPosts }: Props) {
  const [profile, setProfile] = useState<CreatorProfile | null>(initialProfile);
  const [tiers, setTiers] = useState<Tier[]>(initialTiers);
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  // Profile form
  const [handle, setHandle] = useState(initialProfile?.handle ?? '');
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? '');
  const [bio, setBio] = useState(initialProfile?.bio ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(initialProfile?.website_url ?? '');
  const [heroImageUrl, setHeroImageUrl] = useState(initialProfile?.hero_image_url ?? '');
  const [brandColor, setBrandColor] = useState(initialProfile?.brand_color ?? '#059669');
  const [acceptsTips, setAcceptsTips] = useState(initialProfile?.accepts_tips ?? true);
  const [acceptsCommissions, setAcceptsCommissions] = useState(initialProfile?.accepts_commissions ?? false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // Tier form
  const [tTitle, setTTitle] = useState('');
  const [tDescription, setTDescription] = useState('');
  const [tAmount, setTAmount] = useState('5');
  const [tInterval, setTInterval] = useState<'month' | 'year'>('month');
  const [tBenefits, setTBenefits] = useState('');
  const [savingTier, setSavingTier] = useState(false);
  const [tierError, setTierError] = useState<string | null>(null);
  const [busyTierId, setBusyTierId] = useState<string | null>(null);

  // Post form
  const [pTitle, setPTitle] = useState('');
  const [pBody, setPBody] = useState('');
  const [pVisibility, setPVisibility] = useState<'public' | 'members' | 'tier'>('public');
  const [pTierId, setPTierId] = useState('');
  const [savingPost, setSavingPost] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  const activeTiers = tiers.filter((t) => t.active);

  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    setSavingPost(true);
    setPostError(null);
    try {
      const res = await fetch('/api/creators/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pTitle,
          body: pBody,
          visibility: pVisibility,
          minimumTierId: pVisibility === 'tier' ? pTierId || null : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPostError(json.error ?? 'Could not publish that post.');
        return;
      }
      setPosts((prev) => [json.post, ...prev]);
      setPTitle('');
      setPBody('');
    } catch {
      setPostError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSavingPost(false);
    }
  }

  async function deletePost(id: string) {
    setBusyPostId(id);
    setPostError(null);
    try {
      const res = await fetch(`/api/creators/posts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setPostError(json.error ?? 'Could not delete that post.');
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setPostError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusyPostId(null);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const res = await fetch('/api/creators/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          displayName,
          bio,
          websiteUrl,
          heroImageUrl,
          brandColor,
          acceptsTips,
          acceptsCommissions,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setProfileError(json.error ?? 'Could not save your creator page.');
        return;
      }
      setProfile(json.profile);
      setProfileSaved(true);
    } catch {
      setProfileError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function addTier(e: React.FormEvent) {
    e.preventDefault();
    setSavingTier(true);
    setTierError(null);
    // Dollars in the form, cents on the wire. Math.round, not truncation:
    // 19.99 * 100 is 1998.9999999999998 in IEEE 754, and `| 0` would charge
    // members a cent less than the tier says.
    const amountCents = Math.round(Number.parseFloat(tAmount || '0') * 100);
    try {
      const res = await fetch('/api/creators/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tTitle,
          description: tDescription,
          amountCents,
          interval: tInterval,
          benefits: tBenefits.split('\n').map((b) => b.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTierError(json.error ?? 'Could not create that tier.');
        return;
      }
      setTiers((prev) => [...prev, json.tier].sort((a, b) => a.amount_cents - b.amount_cents));
      setTTitle('');
      setTDescription('');
      setTAmount('5');
      setTBenefits('');
    } catch {
      setTierError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSavingTier(false);
    }
  }

  async function setTierActive(tier: Tier, active: boolean) {
    setBusyTierId(tier.id);
    setTierError(null);
    try {
      const res = await fetch('/api/creators/tiers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tier.id, active }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTierError(json.error ?? 'Could not update that tier.');
        return;
      }
      setTiers((prev) => prev.map((t) => (t.id === tier.id ? json.tier : t)));
    } catch {
      setTierError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusyTierId(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* ── Creator page ─────────────────────────────────────────────────── */}
      <Card>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>Your creator page</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.55 }}>
          A public page at <code style={{ fontFamily: 'var(--mono)' }}>charitme.com/creators/{handle || 'your-handle'}</code>{' '}
          showing who you are, your active campaigns, and any membership tiers you offer.
          {profile && (
            <>
              {' '}
              <Link href={`/creators/${profile.handle}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
                View it →
              </Link>
            </>
          )}
        </p>

        <form onSubmit={saveProfile} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }}>
            <Input
              label="Handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              placeholder="jordan-makes"
              required
              hint="3–30 characters. Lowercase letters, numbers, hyphens, underscores."
            />
            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jordan Rivera"
              required
            />
          </div>

          <Textarea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What you make, and what you are raising money for."
            maxLength={1000}
            style={{ minHeight: 96 }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }}>
            <Input
              label="Website"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
            <Input
              label="Hero image URL"
              type="url"
              value={heroImageUrl}
              onChange={(e) => setHeroImageUrl(e.target.value)}
              placeholder="https://…/banner.jpg"
              hint="Leave blank to use your brand colour as the banner."
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--t2)' }}>
              <span>Brand colour</span>
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                style={{ width: 44, height: 30, border: '1px solid var(--b1)', borderRadius: 'var(--r)', background: 'var(--bg)', padding: 2 }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--t2)' }}>
              <input type="checkbox" checked={acceptsTips} onChange={(e) => setAcceptsTips(e.target.checked)} />
              Show &ldquo;Accepts tips&rdquo;
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--t2)' }}>
              <input type="checkbox" checked={acceptsCommissions} onChange={(e) => setAcceptsCommissions(e.target.checked)} />
              Show &ldquo;Open for commissions&rdquo;
            </label>
          </div>

          {profileError && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>{profileError}</p>
          )}
          {profileSaved && !profileError && (
            <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--green-dark)' }}>
              Saved. Your creator page is live.
            </p>
          )}

          <div>
            <Btn type="submit" loading={savingProfile}>
              {profile ? 'Save changes' : 'Create my creator page'}
            </Btn>
          </div>
        </form>
      </Card>

      {/* ── Membership tiers ─────────────────────────────────────────────── */}
      <Card>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>Membership tiers</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.55 }}>
          Recurring support levels shown on your creator page. Only active tiers are public.
        </p>

        {!profile ? (
          <EmptyState
            title="Create your creator page first"
            body="Tiers belong to a creator page, so there is nowhere to attach one until the form above is saved."
          />
        ) : (
          <>
            {tiers.length === 0 ? (
              <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--t3)' }}>
                No tiers yet. The Memberships section stays off your public page until you add one.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'grid', gap: 12 }}>
                {tiers.map((t) => (
                  <li
                    key={t.id}
                    style={{
                      border: '1px solid var(--b1)',
                      borderRadius: 'var(--rl)',
                      padding: 14,
                      background: 'var(--s1)',
                      display: 'flex',
                      gap: 14,
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ minWidth: 220, flex: '1 1 260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 14.5, color: 'var(--t1)' }}>{t.title}</strong>
                        <Badge color={t.active ? 'green' : 'gray'}>{t.active ? 'Active' : 'Retired'}</Badge>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 13.5, fontWeight: 700, color: 'var(--t2)' }}>
                        {money(t.amount_cents)}/{t.interval}
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>{t.description}</p>
                      {t.benefits.length > 0 && (
                        <ul style={{ margin: '8px 0 0', padding: '0 0 0 16px', fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.6 }}>
                          {t.benefits.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      )}
                    </div>
                    <Btn
                      variant="secondary"
                      size="sm"
                      loading={busyTierId === t.id}
                      onClick={() => setTierActive(t, !t.active)}
                    >
                      {t.active ? 'Retire' : 'Reactivate'}
                    </Btn>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={addTier} style={{ display: 'grid', gap: 14, borderTop: '1px solid var(--b1)', paddingTop: 18 }}>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: 'var(--t1)' }}>Add a tier</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 14 }}>
                <Input label="Name" value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="Supporter" required />
                <Input
                  label="Amount (USD)"
                  type="number"
                  min="1"
                  step="0.01"
                  value={tAmount}
                  onChange={(e) => setTAmount(e.target.value)}
                  required
                />
                <Select label="Billed" value={tInterval} onChange={(e) => setTInterval(e.target.value as 'month' | 'year')}>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </Select>
              </div>
              <Textarea
                label="Description"
                value={tDescription}
                onChange={(e) => setTDescription(e.target.value)}
                placeholder="What a member at this level gets."
                required
                style={{ minHeight: 72 }}
              />
              <Textarea
                label="Benefits"
                value={tBenefits}
                onChange={(e) => setTBenefits(e.target.value)}
                placeholder={'One per line\nEarly access to updates\nName in the credits'}
                style={{ minHeight: 72 }}
                hint="One benefit per line. Up to 10."
              />
              {tierError && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>{tierError}</p>}
              <div>
                <Btn type="submit" loading={savingTier}>Add tier</Btn>
              </div>
            </form>

            {/* Stated plainly rather than implied by a missing button. Members
                cannot subscribe yet — the checkout flow is not built — and a
                creator who publishes tiers without knowing that would be waiting
                for signups that cannot happen. */}
            <p style={{ margin: '18px 0 0', fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.55 }}>
              Tiers are shown publicly today, but paid membership checkout is not live yet — visitors
              can see what you offer and cannot subscribe. You will be notified before it turns on.
            </p>
          </>
        )}
      </Card>

      {/* ── Posts ────────────────────────────────────────────────────────── */}
      <Card>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>Posts</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.55 }}>
          Updates on your creator page. Public posts are visible to everyone; members-only posts show
          as locked with their title and date, never a preview of the text.
        </p>

        {!profile ? (
          <EmptyState
            title="Create your creator page first"
            body="Posts appear on your creator page, so there is nowhere to publish one until the form above is saved."
          />
        ) : (
          <>
            {posts.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'grid', gap: 12 }}>
                {posts.map((p) => (
                  <li
                    key={p.id}
                    style={{
                      border: '1px solid var(--b1)',
                      borderRadius: 'var(--rl)',
                      padding: 14,
                      background: 'var(--s1)',
                      display: 'flex',
                      gap: 14,
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ minWidth: 220, flex: '1 1 280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 14.5, color: 'var(--t1)' }}>{p.title}</strong>
                        <Badge color={p.visibility === 'public' ? 'green' : 'blue'}>
                          {p.visibility === 'public'
                            ? 'Public'
                            : p.visibility === 'members'
                              ? 'Members'
                              : `Tier: ${tiers.find((t) => t.id === p.minimum_tier_id)?.title ?? 'unknown'}`}
                        </Badge>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--t4)' }}>
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--t3)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {p.body.length > 220 ? `${p.body.slice(0, 220)}…` : p.body}
                      </p>
                    </div>
                    <Btn
                      variant="secondary"
                      size="sm"
                      loading={busyPostId === p.id}
                      onClick={() => deletePost(p.id)}
                    >
                      Delete
                    </Btn>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={addPost} style={{ display: 'grid', gap: 14, borderTop: posts.length > 0 ? '1px solid var(--b1)' : 'none', paddingTop: posts.length > 0 ? 18 : 0 }}>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: 'var(--t1)' }}>Write a post</h3>
              <Input label="Title" value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="What's new" required />
              <Textarea
                label="Post"
                value={pBody}
                onChange={(e) => setPBody(e.target.value)}
                placeholder="Tell your supporters what you've been working on."
                required
                style={{ minHeight: 120 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14 }}>
                <Select
                  label="Who can read it"
                  value={pVisibility}
                  onChange={(e) => setPVisibility(e.target.value as 'public' | 'members' | 'tier')}
                >
                  <option value="public">Everyone</option>
                  <option value="members">Members only</option>
                  {/* Only offered when a tier exists to point at — otherwise the
                      option leads to a form that cannot be submitted. */}
                  {activeTiers.length > 0 && <option value="tier">A specific tier and above</option>}
                </Select>
                {pVisibility === 'tier' && (
                  <Select label="Minimum tier" value={pTierId} onChange={(e) => setPTierId(e.target.value)} required>
                    <option value="">Choose a tier…</option>
                    {activeTiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} — {money(t.amount_cents)}/{t.interval}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              {postError && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>{postError}</p>}
              <div>
                <Btn type="submit" loading={savingPost}>Publish post</Btn>
              </div>
            </form>

            {activeTiers.length === 0 && (
              <p style={{ margin: '14px 0 0', fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.55 }}>
                You have no active tiers, so a members-only post would currently be readable by nobody
                but you. Public posts work today regardless.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
