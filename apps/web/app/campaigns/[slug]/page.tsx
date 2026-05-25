import { notFound } from 'next/navigation';
import { supabaseAdmin } from '../../../lib/supabase';
import { ProgressBar, Badge, Card } from '../../../components/ui';
import { formatCents } from '../../../lib/stripe';
import DonateButton from './DonateButton';
import type { Metadata } from 'next';

export const revalidate = 30;

interface Props {
  params: Promise<{ slug: string }>;
}

async function getCampaign(slug: string) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select(`
      *,
      profiles:user_id (full_name, avatar_url)
    `)
    .eq('slug', slug)
    .single();
  return data;
}

async function getRecentDonations(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, message, anonymous, created_at, profiles:donor_id(full_name)')
    .eq('campaign_id', campaignId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10);
  return data ?? [];
}

async function getUpdates(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('campaign_updates')
    .select('id, title, body, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) return { title: 'Campaign not found' };
  return {
    title: campaign.title,
    description: campaign.tagline ?? campaign.description?.slice(0, 160),
  };
}

export default async function CampaignPage({ params }: Props) {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) notFound();

  const [donations, updates] = await Promise.all([
    getRecentDonations(campaign.id),
    getUpdates(campaign.id),
  ]);

  const pct = Math.min(100, Math.round(((campaign.raised_amount ?? 0) / campaign.goal_amount) * 100));
  const days = campaign.deadline
    ? Math.max(0, Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: '1000px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '40px', alignItems: 'start' }}>
        {/* Left: campaign content */}
        <div>
          {/* Cover image */}
          {campaign.cover_image_url && (
            <div style={{
              borderRadius: 'var(--rl)',
              overflow: 'hidden',
              marginBottom: '28px',
              aspectRatio: '16/9',
              background: 'var(--s2)',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={campaign.cover_image_url} alt={campaign.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
            <Badge color="gray">{campaign.category}</Badge>
            {campaign.status === 'completed' && <Badge color="green">Goal reached</Badge>}
            {days === 0 && <Badge color="red">Ended</Badge>}
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.2, marginBottom: '12px' }}>
            {campaign.title}
          </h1>
          {campaign.tagline && (
            <p style={{ fontSize: '17px', color: 'var(--t3)', marginBottom: '24px' }}>{campaign.tagline}</p>
          )}

          {campaign.profiles && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--s3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', overflow: 'hidden',
              }}>
                {(campaign.profiles as { avatar_url?: string; full_name?: string }).avatar_url
                  ? <img src={(campaign.profiles as { avatar_url?: string }).avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : '👤'}
              </div>
              <span style={{ fontSize: '14px', color: 'var(--t2)', fontWeight: 500 }}>
                by {(campaign.profiles as { full_name?: string }).full_name ?? 'Anonymous'}
              </span>
            </div>
          )}

          {/* Description */}
          <div style={{
            fontSize: '15px',
            color: 'var(--t2)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            marginBottom: '40px',
          }}>
            {campaign.description}
          </div>

          {/* Updates */}
          {updates.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Campaign updates</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {updates.map((u) => (
                  <Card key={u.id} style={{ padding: '20px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--t4)', marginBottom: '6px' }}>
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    {u.title && <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>{u.title}</h3>}
                    <p style={{ fontSize: '14px', color: 'var(--t2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{u.body}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Recent donors */}
          {donations.length > 0 && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
                Recent donors ({campaign.backer_count ?? 0})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {donations.map((d) => {
                  const profile = d.profiles as { full_name?: string } | null;
                  return (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--b1)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                          {d.anonymous ? 'Anonymous' : (profile?.full_name ?? 'Someone')}
                        </div>
                        {d.message && <div style={{ fontSize: '13px', color: 'var(--t3)', marginTop: '2px' }}>{d.message}</div>}
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '14px', flexShrink: 0 }}>
                        {formatCents(d.amount_cents)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: donate sidebar */}
        <div style={{ position: 'sticky', top: '84px' }}>
          <Card style={{ padding: '24px' }}>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--green)' }}>
                {formatCents(campaign.raised_amount ?? 0)}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--t4)', marginLeft: '6px' }}>
                raised of {formatCents(campaign.goal_amount)} goal
              </span>
            </div>
            <ProgressBar value={campaign.raised_amount ?? 0} max={campaign.goal_amount} />
            <div style={{ display: 'flex', gap: '20px', margin: '14px 0 24px', fontSize: '13px', color: 'var(--t3)' }}>
              <span><strong style={{ color: 'var(--t1)' }}>{pct}%</strong> funded</span>
              <span><strong style={{ color: 'var(--t1)' }}>{campaign.backer_count ?? 0}</strong> donors</span>
              {days !== null && <span><strong style={{ color: 'var(--t1)' }}>{days}</strong> days left</span>}
            </div>

            {campaign.status === 'active' && days !== 0 && (
              <DonateButton campaignId={campaign.id} campaignTitle={campaign.title} />
            )}
            {(campaign.status !== 'active' || days === 0) && (
              <div style={{
                padding: '12px',
                background: 'var(--s2)',
                borderRadius: 'var(--r)',
                fontSize: '14px',
                color: 'var(--t3)',
                textAlign: 'center',
              }}>
                This campaign has ended
              </div>
            )}
          </Card>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 340px"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="position: sticky"] {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
