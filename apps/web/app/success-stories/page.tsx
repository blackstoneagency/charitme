import Link from 'next/link';
import { campaignColumns, applyVisibilityFilters } from '../../lib/campaign-visibility';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { getCoverForCampaign, unsplash } from '../../lib/photo-catalog';
import { attachCampaignCurrencies } from '../../lib/home-data';
import { currencySymbol } from '@shared/currencies';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Success Stories',
  description: 'Real CharitMe success stories from fundraisers and communities creating impact.',
  alternates: { canonical: 'https://www.charitme.com/success-stories' },
};

type StoryCampaign = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_image_url: string | null;
  raised_amount: number;
  goal_amount: number;
  backer_count: number;
  created_at: string;
  currency?: string | null;
};

function formatCents(cents: number, currency: string = 'usd'): string {
  return `${currencySymbol(currency)}${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function shortCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function pct(raised: number, goal: number): number {
  if (!goal) return 0;
  return Math.min(100, Math.round((raised / goal) * 100));
}

async function getStoryData() {
  const cols = await campaignColumns();
  const [{ data: campaigns }, { count: campaignCount }, { count: donationCount }] = await Promise.all([
    applyVisibilityFilters(
      supabaseAdmin
        .from('campaigns')
        .select('id,slug,title,description,category,cover_image_url,raised_amount,goal_amount,backer_count,created_at')
        .in('status', ['active', 'completed']),
      cols,
    )
      .order('raised_amount', { ascending: false })
      .limit(9),
    applyVisibilityFilters(supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).in('status', ['active', 'completed']), cols),
    supabaseAdmin.from('donations').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
  ]);

  const stories = await attachCampaignCurrencies((campaigns ?? []) as StoryCampaign[]);
  const totalRaised = stories.reduce((sum, s) => sum + s.raised_amount, 0);
  const totalDonors = stories.reduce((sum, s) => sum + s.backer_count, 0);

  return { stories, campaignCount: campaignCount ?? 0, donationCount: donationCount ?? 0, totalRaised, totalDonors };
}

const HERO_PHOTOS = [
  unsplash('1469571486292-0ba58a3f068b', true),
  unsplash('1593113598332-cd288d649433', true),
  unsplash('1488521787991-ed7bbaae773c', true),
];

const COMMUNITY_PHOTOS = [
  unsplash('1532629345422-7515f3d16bb6'),
  unsplash('1509099836639-18ba1795216d'),
  unsplash('1503454537195-1dcabb73ffb9'),
];

export default async function SuccessStoriesPage() {
  const { stories, campaignCount, donationCount, totalRaised, totalDonors } = await getStoryData();

  const featured = stories[0] ?? null;
  const gridStories = stories.slice(featured ? 1 : 0);

  return (
    <div style={{ background: 'var(--bg, #f8f7ff)', minHeight: '100vh' }}>

      {/* ── Dark Hero ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0e0520 0%, #1a0640 50%, #0e0520 100%)',
        padding: '80px 0 72px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -120, left: '8%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,53,255,.32) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, right: '4%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,59,239,.22) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(108,53,255,.25)', border: '1px solid rgba(108,53,255,.4)', borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 800, color: '#b89eff', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              ✦ Real Impact
            </span>
          </div>

          <div className="ss-hero-grid">
            <div>
              <h1 style={{ fontSize: 'clamp(32px, 5vw, 58px)', fontWeight: 950, color: '#fff', lineHeight: 1.12, maxWidth: 680, margin: '0 0 20px' }}>
                Real people. Real stories.<br />
                <span style={{ background: 'linear-gradient(90deg, #a78bfa, #e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Real impact.</span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 18, lineHeight: 1.7, maxWidth: 540, margin: '0 0 40px' }}>
                See how individuals, nonprofits, and communities achieved their goals with CharitMe — powered by AI and zero mandatory fees.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 56 }}>
                <Link href="/create" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 52, padding: '0 28px', borderRadius: 14, background: 'linear-gradient(135deg,#6736ff,#d63ae7)', color: '#fff', fontWeight: 900, fontSize: 15, textDecoration: 'none', boxShadow: '0 16px 32px rgba(103,54,255,.4)' }}>
                  Start Your Fundraiser &#8594;
                </Link>
                <a href="#stories" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 52, padding: '0 28px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,.2)', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', background: 'rgba(255,255,255,.07)' }}>
                  Browse All Stories
                </a>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {[
                  { value: shortCount(campaignCount), label: 'Campaigns' },
                  { value: formatCents(totalRaised), label: 'Total Raised' },
                  { value: shortCount(donationCount), label: 'Donations' },
                  { value: shortCount(totalDonors), label: 'Supporters' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: '18px 24px', minWidth: 120 }}>
                    <div style={{ fontSize: 30, fontWeight: 950, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ss-hero-collage">
              <div style={{ gridColumn: '1 / 3', height: 180, borderRadius: 20, backgroundImage: `url(${HERO_PHOTOS[0]})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }} />
              <div style={{ height: 140, borderRadius: 16, backgroundImage: `url(${HERO_PHOTOS[1]})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.35)' }} />
              <div style={{ height: 140, borderRadius: 16, backgroundImage: `url(${HERO_PHOTOS[2]})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.35)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Story ── */}
      {featured && (
        <section style={{ background: 'var(--s1, #fff)', borderBottom: '1px solid var(--b1, #ede9fe)', padding: '64px 0' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--violet, #6c35ff)', textTransform: 'uppercase', letterSpacing: '.12em' }}>Featured Story</span>
              <h2 style={{ fontSize: 'clamp(22px,3vw,36px)', fontWeight: 950, color: 'var(--t1, #0e0520)', margin: '10px 0 0' }}>Community spotlight</h2>
            </div>
            <Link href={`/campaigns/${featured.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div className="ss-featured-grid">
                <div style={{ borderRadius: 18, overflow: 'hidden', height: 340, backgroundImage: `url(${featured.cover_image_url || getCoverForCampaign(featured.category, featured.slug)})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 16px 48px rgba(108,53,255,.18)' }} />
                <div>
                  {featured.category && (
                    <span style={{ display: 'inline-block', background: 'rgba(108,53,255,.1)', color: 'var(--violet, #6c35ff)', borderRadius: 999, padding: '4px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16 }}>
                      {featured.category}
                    </span>
                  )}
                  <h3 style={{ fontSize: 'clamp(20px,2.5vw,30px)', fontWeight: 950, color: 'var(--t1, #0e0520)', lineHeight: 1.25, margin: '0 0 16px' }}>{featured.title}</h3>
                  <p style={{ fontSize: 15, color: 'var(--t2, #475569)', lineHeight: 1.75, margin: '0 0 28px' }}>
                    {featured.description ?? 'This campaign is building momentum and creating real community impact through CharitMe.'}
                  </p>
                  <div className="ss-featured-stats">
                    {[
                      { val: formatCents(featured.raised_amount, featured.currency ?? 'usd'), lbl: 'Raised' },
                      { val: featured.backer_count.toLocaleString(), lbl: 'Donors' },
                      { val: `${pct(featured.raised_amount, featured.goal_amount)}%`, lbl: 'Funded' },
                    ].map(s => (
                      <div key={s.lbl} style={{ textAlign: 'center', background: 'var(--s1, #fff)', borderRadius: 14, padding: '14px 10px', border: '1px solid var(--b1, #ede9fe)' }}>
                        <div style={{ fontSize: 22, fontWeight: 950, color: 'var(--violet, #6c35ff)' }}>{s.val}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3, #94a3b8)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>{s.lbl}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'var(--b1, #ede9fe)', borderRadius: 999, height: 8, overflow: 'hidden', marginBottom: 24 }}>
                    <div style={{ width: `${pct(featured.raised_amount, featured.goal_amount)}%`, height: '100%', background: 'linear-gradient(90deg, #6736ff, #d63ae7)', borderRadius: 999 }} />
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 24px', borderRadius: 12, background: 'linear-gradient(135deg,#6736ff,#d63ae7)', color: '#fff', fontWeight: 900, fontSize: 14 }}>
                    View Full Story &#8594;
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ── Story Grid ── */}
      <section id="stories" style={{ padding: '72px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--violet, #6c35ff)', textTransform: 'uppercase', letterSpacing: '.12em' }}>All Stories</span>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 950, color: 'var(--t1, #0e0520)', margin: '10px 0 14px' }}>Every campaign tells a story</h2>
            <p style={{ color: 'var(--t3, #64748b)', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>Browse verified fundraisers from real people and nonprofits making a difference.</p>
          </div>

          {gridStories.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
              {gridStories.map((story) => {
                const cover = story.cover_image_url || getCoverForCampaign(story.category, story.slug);
                const progress = pct(story.raised_amount, story.goal_amount);
                return (
                  <Link key={story.slug} href={`/campaigns/${story.slug}`} style={{ textDecoration: 'none' }}>
                    <div className="feat-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ height: 200, backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                        {story.category && (
                          <span style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(14,5,32,.7)', backdropFilter: 'blur(8px)', color: '#e0d4ff', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                            {story.category}
                          </span>
                        )}
                        <span style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(14,5,32,.7)', backdropFilter: 'blur(8px)', color: '#a78bfa', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 800 }}>
                          &#9829; {story.backer_count.toLocaleString()} donors
                        </span>
                      </div>
                      <div style={{ padding: '20px 22px 22px' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--t1, #0e0520)', margin: '0 0 8px', lineHeight: 1.35 }}>{story.title}</h3>
                        <p style={{ fontSize: 13, color: 'var(--t3, #64748b)', lineHeight: 1.6, margin: '0 0 18px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {story.description ?? 'Building momentum with live campaign data from the CharitMe community.'}
                        </p>
                        <div style={{ background: 'var(--s2, #f1eefe)', borderRadius: 999, height: 6, overflow: 'hidden', marginBottom: 14 }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #6736ff, #d63ae7)', borderRadius: 999 }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 950, color: 'var(--violet, #6c35ff)' }}>{formatCents(story.raised_amount, story.currency ?? 'usd')}</div>
                            <div style={{ fontSize: 11, color: 'var(--t3, #94a3b8)', fontWeight: 600 }}>of {formatCents(story.goal_amount, story.currency ?? 'usd')} goal</div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--violet, #6c35ff)' }}>{progress}% funded &#8594;</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#128156;</div>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: 'var(--t1, #0e0520)', marginBottom: 12 }}>Stories coming soon</h3>
              <p style={{ color: 'var(--t3, #64748b)', marginBottom: 28 }}>Be the first to create a campaign and share your story.</p>
              <Link href="/create" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 28px', borderRadius: 12, background: 'linear-gradient(135deg,#6736ff,#d63ae7)', color: '#fff', fontWeight: 900, fontSize: 15, textDecoration: 'none' }}>
                Start Your Fundraiser &#8594;
              </Link>
            </div>
          )}

          {stories.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 48 }}>
              <Link href="/campaigns" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 50, padding: '0 32px', borderRadius: 14, border: '2px solid var(--violet, #6c35ff)', color: 'var(--violet, #6c35ff)', fontWeight: 900, fontSize: 15, textDecoration: 'none', background: 'var(--s1, #fff)' }}>
                View All Campaigns &#8594;
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Testimonials ── */}
      {stories.length > 0 && (
        <section style={{ background: 'var(--s1, #fff)', borderTop: '1px solid var(--b1, #ede9fe)', borderBottom: '1px solid var(--b1, #ede9fe)', padding: '72px 0' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--violet, #6c35ff)', textTransform: 'uppercase', letterSpacing: '.12em' }}>Community Voices</span>
              <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 950, color: 'var(--t1, #0e0520)', margin: '10px 0 14px' }}>What our fundraisers say</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              {stories.slice(0, 3).map((story, i) => (
                <div key={story.slug} style={{ background: 'linear-gradient(145deg, var(--s1, #faf8ff), var(--s2, #f3f0ff))', border: '1.5px solid var(--b1, #ede9fe)', borderRadius: 20, padding: '28px', position: 'relative' }}>
                  <div style={{ fontSize: 48, fontWeight: 950, color: 'var(--b1, #ede9fe)', lineHeight: 1, position: 'absolute', top: 16, right: 24, userSelect: 'none' }}>&ldquo;</div>
                  <p style={{ fontSize: 15, color: 'var(--t2, #475569)', lineHeight: 1.7, margin: '0 0 24px', fontStyle: 'italic', position: 'relative', zIndex: 1 }}>
                    &ldquo;{story.description ?? `${story.title} has brought our community together in ways we never imagined possible.`}&rdquo;
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundImage: `url(${COMMUNITY_PHOTOS[i % COMMUNITY_PHOTOS.length]})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0, border: '2px solid var(--b1, #ede9fe)' }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1, #0e0520)' }}>{story.title.split(' ').slice(0, 3).join(' ')}</div>
                      <div style={{ fontSize: 12, color: 'var(--t3, #94a3b8)', fontWeight: 600 }}>{story.category ?? 'Campaign'} &middot; {formatCents(story.raised_amount, story.currency ?? 'usd')} raised</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Impact Stats ── */}
      <section style={{ padding: '72px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--violet, #6c35ff)', textTransform: 'uppercase', letterSpacing: '.12em' }}>By the Numbers</span>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 950, color: 'var(--t1, #0e0520)', margin: '10px 0 14px' }}>Community impact</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, maxWidth: 800, margin: '0 auto' }}>
            {[
              { icon: '&#128156;', value: shortCount(campaignCount), label: 'Stories Shared' },
              { icon: '&#129309;', value: shortCount(totalDonors), label: 'Supporters' },
              { icon: '&#128176;', value: formatCents(totalRaised), label: 'Raised Together' },
              { icon: '&#127873;', value: shortCount(donationCount), label: 'Donations Made' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', background: 'var(--s1, #fff)', border: '1.5px solid var(--b1, #ede9fe)', borderRadius: 20, padding: '32px 20px', boxShadow: '0 4px 20px rgba(108,53,255,.06)' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: s.icon }} />
                <div style={{ fontSize: 32, fontWeight: 950, color: 'var(--violet, #6c35ff)', lineHeight: 1, marginBottom: 8 }}>{s.value}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3, #94a3b8)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0e0520 0%, #1a0640 100%)',
        padding: '80px 0',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(108,53,255,.3) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(26px,4vw,46px)', fontWeight: 950, color: '#fff', margin: '0 0 16px' }}>
            Ready to write your story?
          </h2>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 17, margin: '0 auto 36px', maxWidth: 480 }}>
            Join thousands of fundraisers who trust CharitMe&apos;s AI-powered platform to amplify their impact.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 14 }}>
            <Link href="/create" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 54, padding: '0 32px', borderRadius: 15, background: 'linear-gradient(135deg,#6736ff,#d63ae7)', color: '#fff', fontWeight: 900, fontSize: 16, textDecoration: 'none', boxShadow: '0 16px 40px rgba(103,54,255,.45)' }}>
              Start Your Fundraiser Free &#8594;
            </Link>
            <Link href="/campaigns" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 54, padding: '0 32px', borderRadius: 15, border: '1.5px solid rgba(255,255,255,.2)', color: '#fff', fontWeight: 800, fontSize: 16, textDecoration: 'none', background: 'rgba(255,255,255,.07)' }}>
              Browse Campaigns
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
