import Link from 'next/link';
import { supabaseAdmin } from '../lib/supabase';
import { ProgressBar, Badge, Card } from '../components/ui';
import { formatCents } from '../lib/stripe';
import {
  AI_MOAT_FEATURES,
  GROWTH_PLAYBOOK,
  TRUST_PILLARS,
  calculateTrustScore,
  getTrustLabel,
} from '../lib/ai-platform';

export const dynamic = 'force-dynamic';

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
    .select('raised_amount, backer_count')
    .eq('status', 'active');
  const total = (data ?? []).reduce((sum, campaign) => sum + (campaign.raised_amount ?? 0), 0);
  const donors = (data ?? []).reduce((sum, campaign) => sum + (campaign.backer_count ?? 0), 0);
  return { total, donors, count: data?.length ?? 0 };
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
      <section style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 48%, #eef2ff 100%)',
        padding: '72px 0 56px',
        borderBottom: '1px solid var(--b1)',
      }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, .9fr)', gap: '40px', alignItems: 'center' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              background: '#fff',
              border: '1px solid var(--b1)',
              borderRadius: '99px',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--green-dark)',
              marginBottom: '22px',
            }}>
              AI-powered trusted fundraising network
            </div>
            <h1 style={{
              fontSize: '52px',
              fontWeight: 800,
              color: 'var(--t1)',
              lineHeight: 1.04,
              marginBottom: '20px',
              maxWidth: '760px',
            }}>
              The safest and smartest way to raise money online.
            </h1>
            <p style={{ fontSize: '18px', color: 'var(--t2)', maxWidth: '640px', marginBottom: '30px' }}>
              RaiseMoney combines trust verification, campaign coaching, donor conversion, and transparent payouts so urgent causes can earn confidence faster.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '34px' }}>
              <Link href="/login?mode=signup" style={{
                minHeight: '44px',
                padding: '12px 24px',
                background: 'var(--green)',
                color: '#fff',
                borderRadius: 'var(--r)',
                fontWeight: 700,
                fontSize: '15px',
              }}>
                Start a 30-second fundraiser
              </Link>
              <Link href="/campaigns" style={{
                minHeight: '44px',
                padding: '12px 24px',
                background: '#fff',
                color: 'var(--t1)',
                borderRadius: 'var(--r)',
                fontWeight: 700,
                fontSize: '15px',
                border: '1px solid var(--b1)',
              }}>
                Browse trusted campaigns
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: '14px', maxWidth: '620px' }}>
              {[
                { label: 'Raised on platform', value: formatCents(stats.total) },
                { label: 'Active campaigns', value: stats.count.toLocaleString() },
                { label: 'Donor signals', value: stats.donors.toLocaleString() },
              ].map((stat) => (
                <div key={stat.label} style={{ background: 'rgba(255,255,255,.72)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: '14px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)' }}>{stat.value}</div>
                  <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <Card style={{ padding: '24px', background: 'rgba(255,255,255,.86)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t3)', marginBottom: '4px' }}>AI Trust Engine</div>
                <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Trust before traffic</h2>
              </div>
              <Badge color="green">Live scoring</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {TRUST_PILLARS.map((pillar, index) => (
                <div key={pillar} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: index < 2 ? 'var(--green-light)' : 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: index < 2 ? 'var(--green-dark)' : 'var(--blue)' }}>
                    {index + 1}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t2)' }}>{pillar}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section style={{ padding: '64px 0' }}>
        <div className="container">
          <div style={{ maxWidth: '760px', marginBottom: '30px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '10px' }}>The moat is trust, growth, and speed.</h2>
            <p style={{ color: 'var(--t3)', fontSize: '15px' }}>
              RaiseMoney is built as an active fundraising assistant, not passive campaign hosting.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
            {AI_MOAT_FEATURES.map((feature) => (
              <Card key={feature.title} style={{ padding: '20px' }}>
                <Badge color="blue">AI moat</Badge>
                <h3 style={{ fontSize: '17px', fontWeight: 800, marginTop: '14px', marginBottom: '8px' }}>{feature.title}</h3>
                <p style={{ fontSize: '13px', color: 'var(--t4)', marginBottom: '10px' }}>{feature.complaint}</p>
                <p style={{ fontSize: '14px', color: 'var(--t2)', lineHeight: 1.55 }}>{feature.solution}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {campaigns.length > 0 && (
        <section style={{ padding: '8px 0 64px' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Trusted campaigns gaining momentum</h2>
                <p style={{ fontSize: '14px', color: 'var(--t3)' }}>Each page surfaces donor confidence signals before the ask.</p>
              </div>
              <Link href="/campaigns" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green)' }}>
                View all campaigns
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {campaigns.map((campaign) => {
                const pct = Math.min(100, Math.round(((campaign.raised_amount ?? 0) / campaign.goal_amount) * 100));
                const days = daysLeft(campaign.deadline);
                const trustScore = calculateTrustScore(campaign);
                return (
                  <Link key={campaign.id} href={`/campaigns/${campaign.slug}`} style={{ textDecoration: 'none' }}>
                    <Card style={{ cursor: 'pointer' }}>
                      <div style={{
                        height: '184px',
                        background: campaign.cover_image_url
                          ? `url(${campaign.cover_image_url}) center/cover`
                          : 'linear-gradient(135deg, var(--green-light), var(--blue-light))',
                        position: 'relative',
                      }}>
                        <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <Badge color="gray">{campaign.category}</Badge>
                          <Badge color={trustScore >= 70 ? 'green' : 'blue'}>{getTrustLabel(trustScore)}</Badge>
                        </div>
                      </div>
                      <div style={{ padding: '18px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px', color: 'var(--t1)' }}>{campaign.title}</h3>
                        {campaign.tagline && <p style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '14px', lineHeight: 1.45 }}>{campaign.tagline}</p>}
                        <ProgressBar value={campaign.raised_amount ?? 0} max={campaign.goal_amount} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, color: 'var(--green)', fontSize: '14px' }}>
                            {formatCents(campaign.raised_amount ?? 0)}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--t4)' }}>
                            {pct}% funded{days !== null ? ` · ${days}d left` : ''} · {campaign.backer_count ?? 0} donors
                          </span>
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

      <section style={{ padding: '64px 0', background: 'var(--s1)', borderTop: '1px solid var(--b1)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, .8fr) minmax(280px, 1fr)', gap: '32px', alignItems: 'start' }}>
          <div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '10px' }}>AI that helps campaigns win.</h2>
            <p style={{ color: 'var(--t3)', fontSize: '15px' }}>
              The platform keeps helping after launch with smarter writing, outreach, donor conversion, and transparency prompts.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {GROWTH_PLAYBOOK.map((item) => (
              <div key={item} style={{ background: '#fff', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--t2)' }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 860px) {
          section .container[style*="grid-template-columns: minmax(0, 1.1fr)"] {
            grid-template-columns: 1fr !important;
          }
          section .container[style*="grid-template-columns: minmax(0, .8fr)"] {
            grid-template-columns: 1fr !important;
          }
          h1 {
            font-size: 36px !important;
          }
        }
      `}</style>
    </>
  );
}
