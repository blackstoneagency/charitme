import Link from 'next/link';
import { supabaseAdmin } from '../lib/supabase';
import { ProgressBar, Badge, Card } from '../components/ui';
import { formatCents } from '../lib/stripe';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';

export const revalidate = 60;

async function getFeaturedCampaigns() {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status')
    .eq('status', 'active')
    .order('raised_amount', { ascending: false })
    .limit(6);
  return data ?? [];
}

async function getStats() {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('raised_amount')
    .eq('status', 'active');
  const total = (data ?? []).reduce((s, c) => s + (c.raised_amount ?? 0), 0);
  return { total, count: data?.length ?? 0 };
}

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export default async function HomePage() {
  const [campaigns, stats] = await Promise.all([getFeaturedCampaigns(), getStats()]);

  return (
    <>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)',
        padding: '80px 0 60px',
        textAlign: 'center',
      }}>
        <div className="container">
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            background: 'var(--green-light)',
            borderRadius: '99px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--green-dark)',
            marginBottom: '24px',
          }}>
            <span>🌱</span> Fund what matters
          </div>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 800,
            color: 'var(--t1)',
            letterSpacing: '-1px',
            lineHeight: 1.1,
            marginBottom: '20px',
          }}>
            The fastest way to<br />raise money online
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--t3)', maxWidth: '520px', margin: '0 auto 36px' }}>
            Start a campaign in minutes. Share your story. Receive donations directly to your account.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login?mode=signup" style={{
              padding: '14px 32px',
              background: 'var(--green)',
              color: '#fff',
              borderRadius: 'var(--rl)',
              fontWeight: 700,
              fontSize: '16px',
            }}>
              Start a campaign — it&apos;s free
            </Link>
            <Link href="/campaigns" style={{
              padding: '14px 32px',
              background: '#fff',
              color: 'var(--t1)',
              borderRadius: 'var(--rl)',
              fontWeight: 600,
              fontSize: '16px',
              border: '1px solid var(--b1)',
            }}>
              Browse campaigns
            </Link>
          </div>

          {/* Stats bar */}
          {stats.count > 0 && (
            <div style={{
              display: 'flex',
              gap: '48px',
              justifyContent: 'center',
              marginTop: '48px',
              flexWrap: 'wrap',
            }}>
              {[
                { label: 'Total raised', value: formatCents(stats.total) },
                { label: 'Active campaigns', value: stats.count.toLocaleString() },
                { label: 'Platform fee', value: '5%' },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--t1)' }}>{s.value}</div>
                  <div style={{ fontSize: '13px', color: 'var(--t4)', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured campaigns */}
      {campaigns.length > 0 && (
        <section style={{ padding: '64px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Featured campaigns</h2>
              <Link href="/campaigns" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--green)' }}>
                View all →
              </Link>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '24px',
            }}>
              {campaigns.map((c) => {
                const pct = Math.min(100, Math.round(((c.raised_amount ?? 0) / c.goal_amount) * 100));
                const days = daysLeft(c.deadline);
                return (
                  <Link key={c.id} href={`/campaigns/${c.slug}`} style={{ textDecoration: 'none' }}>
                    <Card style={{ transition: 'box-shadow .2s', cursor: 'pointer' }}>
                      <div style={{
                        height: '200px',
                        background: c.cover_image_url
                          ? `url(${c.cover_image_url}) center/cover`
                          : 'linear-gradient(135deg, var(--green-light), var(--s2))',
                        position: 'relative',
                      }}>
                        <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                          <Badge color="gray">{c.category}</Badge>
                        </div>
                      </div>
                      <div style={{ padding: '20px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: 'var(--t1)' }}>
                          {c.title}
                        </h3>
                        {c.tagline && (
                          <p style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '16px', lineHeight: 1.4 }}>
                            {c.tagline}
                          </p>
                        )}
                        <ProgressBar value={c.raised_amount ?? 0} max={c.goal_amount} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                          <div>
                            <span style={{ fontWeight: 700, color: 'var(--green)' }}>
                              {formatCents(c.raised_amount ?? 0)}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--t4)', marginLeft: '4px' }}>
                              raised of {formatCents(c.goal_amount)}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--t3)' }}>
                            {pct}% · {days !== null ? `${days}d left` : ''} · {c.backer_count ?? 0} donors
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section style={{ padding: '64px 0', background: 'var(--s1)' }}>
        <div className="container">
          <h2 style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '48px' }}>
            How it works
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '32px',
          }}>
            {[
              { step: '1', title: 'Start your campaign', body: 'Create a campaign page with your story, goal, and photos in minutes.' },
              { step: '2', title: 'Share it everywhere', body: 'Share your campaign link on social media, email, and messaging apps.' },
              { step: '3', title: 'Receive donations', body: 'Donors give securely via card. Funds go directly to you via Stripe.' },
            ].map((s) => (
              <div key={s.step} style={{ textAlign: 'center' }}>
                <div style={{
                  width: '48px', height: '48px',
                  background: 'var(--green)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: '18px',
                  margin: '0 auto 16px',
                }}>
                  {s.step}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>{s.title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--t3)', lineHeight: 1.6 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section style={{ padding: '64px 0' }}>
        <div className="container">
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Browse by category</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {CAMPAIGN_CATEGORIES.map((cat) => (
              <Link key={cat} href={`/campaigns?category=${encodeURIComponent(cat)}`} style={{
                padding: '8px 16px',
                background: 'var(--s1)',
                border: '1px solid var(--b1)',
                borderRadius: '99px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--t2)',
                transition: 'border-color .15s',
              }}>
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
