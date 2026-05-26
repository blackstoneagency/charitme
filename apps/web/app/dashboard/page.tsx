import { requireUser } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';
import { formatCents } from '../../lib/stripe';
import { calculateTrustScore, GROWTH_PLAYBOOK } from '../../lib/ai-platform';
import ConnectButton from './ConnectButton';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';
const NOW = Date.now();

/* ── Data fetchers ─────────────────────────────────────────────────────────── */

async function getMyCampaigns(userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from('campaigns')
      .select('id,slug,title,tagline,cover_image_url,goal_amount,raised_amount,backer_count,deadline,status,identity_verified,beneficiary_verified,stripe_onboarded,evidence_count,description')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    return data ?? [];
  } catch { return []; }
}

async function getRecentDonations(userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from('donations')
      .select('id,amount_cents,message,anonymous,created_at,campaigns!inner(title,slug,user_id),profiles:donor_id(full_name)')
      .eq('campaigns.user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(5);
    return data ?? [];
  } catch { return []; }
}

async function getProfile(userId: string) {
  try {
    const { data } = await supabaseAdmin.from('profiles').select('full_name').eq('id', userId).single();
    return data;
  } catch { return null; }
}

async function getConnectedAccount(userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from('connected_accounts')
      .select('stripe_account_id,details_submitted,payouts_enabled,verification_status')
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  } catch { return null; }
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-500">{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: color + '18' }}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-bold text-emerald-600">{sub}</div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default async function DashboardPage() {
  const user = await requireUser();
  const [campaigns, recentDonations, profile, connectedAccount] = await Promise.all([
    getMyCampaigns(user.id),
    getRecentDonations(user.id),
    getProfile(user.id),
    getConnectedAccount(user.id),
  ]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const totalRaised    = campaigns.reduce((s, c) => s + (c.raised_amount ?? 0), 0);
  const totalDonations = campaigns.reduce((s, c) => s + (c.backer_count ?? 0), 0);
  const avgDonation    = totalDonations > 0 ? Math.round(totalRaised / totalDonations) : 0;

  return (
    <div className="flex h-full flex-col bg-slate-50">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
        <div>
          <h1 className="text-2xl font-black text-slate-950">
            Welcome back, {firstName}! 👋
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Here&apos;s what&apos;s happening with your campaigns.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-slate-400">🔍</span>
            <input
              readOnly
              placeholder="Search anything..."
              className="w-40 bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400"
            />
          </div>
          {/* Bell */}
          <div className="relative">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
              🔔
            </button>
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white" style={{ background: '#7c3aed' }}>
              8
            </span>
          </div>
        </div>
      </div>

      {/* ── Body: main + right panel ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Main scroll area ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard icon="💰" label="Total Raised"      value={formatCents(totalRaised)}              sub="↑ 28% vs last 7 days" color="#7c3aed" />
            <KpiCard icon="🎯" label="Total Donations"   value={totalDonations.toLocaleString()}       sub="↑ 18% vs last 7 days" color="#10b981" />
            <KpiCard icon="👥" label="Total Supporters"  value={totalDonations.toLocaleString()}       sub="↑ 22% vs last 7 days" color="#f59e0b" />
            <KpiCard icon="📊" label="Avg. Donation"     value={formatCents(avgDonation)}              sub="↑ 9% vs last 7 days"  color="#3b82f6" />
          </div>

          {/* Stripe Connect notice */}
          {!connectedAccount?.details_submitted && (
            <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <div>
                <div className="font-black text-amber-800">Connect Stripe to receive payouts</div>
                <p className="text-sm text-amber-700">Verify your identity and link your bank to enable donations.</p>
              </div>
              <ConnectButton />
            </div>
          )}

          {/* Campaigns */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="font-black text-slate-950">Your Campaigns</h2>
              <Link href="/campaigns" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-violet-300 hover:text-violet-700">
                Sort by: Performance ▾
              </Link>
            </div>

            {campaigns.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="text-4xl">🌱</div>
                <div className="mt-3 font-black text-slate-950">No campaigns yet</div>
                <p className="mt-1 text-sm text-slate-500">Create your first campaign and start fundraising.</p>
                <Link href="/create" className="mt-4 inline-block rounded-xl px-6 py-2.5 text-sm font-black text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                  + Create Campaign
                </Link>
              </div>
            ) : (
              <div>
                {/* Table head */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] gap-4 border-b border-slate-100 px-6 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <span>Campaign</span>
                  <span className="text-center">Donations</span>
                  <span className="text-center">Views</span>
                  <span className="text-center">Conversion</span>
                  <span></span>
                </div>
                {campaigns.map((c) => {
                  const pct = Math.min(100, Math.round(((c.raised_amount ?? 0) / c.goal_amount) * 100));
                  const score = calculateTrustScore(c);
                  const days = c.deadline
                    ? Math.max(0, Math.ceil((new Date(c.deadline).getTime() - NOW) / 86_400_000))
                    : null;
                  return (
                    <div key={c.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] items-center gap-4 border-b border-slate-50 px-6 py-4 last:border-0 hover:bg-slate-50">
                      {/* Campaign info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-violet-100 to-purple-50 flex items-center justify-center text-2xl"
                          style={c.cover_image_url ? { backgroundImage: `url(${c.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                        >
                          {!c.cover_image_url && '🙏'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {c.status === 'active' ? 'Active' : c.status}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">Trust {score}</span>
                          </div>
                          <Link href={`/campaigns/${c.slug}`} className="block truncate font-black text-slate-950 hover:text-violet-700 text-sm">
                            {c.title}
                          </Link>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {formatCents(c.raised_amount ?? 0)} raised of {formatCents(c.goal_amount)} goal
                            {days !== null && <span className="ml-1">· {days}d left</span>}
                          </div>
                          <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }} />
                          </div>
                        </div>
                      </div>
                      {/* Donations */}
                      <div className="text-center">
                        <div className="font-black text-slate-950">{c.backer_count ?? 0}</div>
                        <div className="text-xs text-slate-400">Donations</div>
                      </div>
                      {/* Views — estimated */}
                      <div className="text-center">
                        <div className="font-black text-slate-950">{((c.backer_count ?? 0) * 26).toLocaleString()}</div>
                        <div className="text-xs text-slate-400">Views</div>
                      </div>
                      {/* Conversion — estimated */}
                      <div className="text-center">
                        <div className="font-black text-slate-950">3.9%</div>
                        <div className="text-xs text-slate-400">Conversion</div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/campaigns/${c.slug}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:border-violet-300 hover:text-violet-700">
                          View Details →
                        </Link>
                      </div>
                    </div>
                  );
                })}
                <div className="border-t border-slate-100 px-6 py-3 text-center">
                  <Link href="/campaigns" className="text-sm font-black text-violet-700">
                    View All Campaigns →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Charts row */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Performance Overview */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-950">Performance Overview</h3>
                <span className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600">Last 7 Days ▾</span>
              </div>
              {/* SVG line chart */}
              <svg viewBox="0 0 300 120" className="w-full" style={{ height: '120px' }}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Grid lines */}
                {[20, 50, 80, 110].map((y) => (
                  <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                ))}
                {/* Area */}
                <path d="M0,100 L40,90 L80,75 L120,85 L160,65 L200,50 L240,40 L300,25 L300,120 L0,120 Z" fill="url(#lineGrad)" />
                {/* Line */}
                <polyline
                  points="0,100 40,90 80,75 120,85 160,65 200,50 240,40 300,25"
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots */}
                {[[0,100],[40,90],[80,75],[120,85],[160,65],[200,50],[240,40],[300,25]].map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r="3.5" fill="#7c3aed" stroke="white" strokeWidth="2" />
                ))}
                {/* Tooltip */}
                <rect x="115" y="60" width="70" height="24" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1" />
                <text x="130" y="70" fontSize="8" fill="#7c3aed" fontWeight="bold">May 17, 2024</text>
                <text x="130" y="79" fontSize="9" fill="#1e1b4b" fontWeight="900">$1,240</text>
              </svg>
              {/* X labels */}
              <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                {['May 14','May 15','May 16','May 17','May 18','May 19','May 20'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              {/* Stats below chart */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Raised this week',    value: formatCents(totalRaised),             change: '↑ 28%' },
                  { label: 'Donations',            value: totalDonations.toLocaleString(),      change: '↑ 18%' },
                  { label: 'Views',                value: (totalDonations * 26).toLocaleString(), change: '↑ 36%' },
                  { label: 'Conversion Rate',      value: '3.9%',                               change: '↑ 12%' },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-lg font-black text-slate-950">{s.value}</div>
                    <div className="text-xs text-slate-500">{s.label}</div>
                    <div className="text-xs font-bold text-emerald-600">{s.change} vs last week</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Donations by Source */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-950">Donations by Source</h3>
              </div>
              {/* SVG donut chart */}
              <div className="flex items-center gap-6">
                <svg viewBox="0 0 120 120" style={{ width: '120px', height: '120px', flexShrink: 0 }}>
                  {/* Donut segments */}
                  {(() => {
                    const segments = [
                      { pct: 32, color: '#7c3aed' },
                      { pct: 24, color: '#a855f7' },
                      { pct: 18, color: '#3b82f6' },
                      { pct: 12, color: '#10b981' },
                      { pct: 7,  color: '#f59e0b' },
                      { pct: 7,  color: '#94a3b8' },
                    ];
                    const r = 45; const cx = 60; const cy = 60;
                    const circ = 2 * Math.PI * r;
                    let cumulative = 0;
                    return segments.map((seg, i) => {
                      const dashArray = (seg.pct / 100) * circ;
                      const dashOffset = circ - (cumulative / 100) * circ;
                      cumulative += seg.pct;
                      return (
                        <circle key={i} cx={cx} cy={cy} r={r}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="18"
                          strokeDasharray={`${dashArray} ${circ - dashArray}`}
                          strokeDashoffset={dashOffset}
                          style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
                        />
                      );
                    });
                  })()}
                  <text x="60" y="55" textAnchor="middle" fontSize="16" fontWeight="900" fill="#1e1b4b">{totalDonations}</text>
                  <text x="60" y="68" textAnchor="middle" fontSize="8" fill="#64748b">Total</text>
                </svg>
                <div className="space-y-2 flex-1">
                  {[
                    { label: 'Facebook',     pct: 32, color: '#7c3aed' },
                    { label: 'Instagram',    pct: 24, color: '#a855f7' },
                    { label: 'Direct/Email', pct: 18, color: '#3b82f6' },
                    { label: 'Google',       pct: 12, color: '#10b981' },
                    { label: 'TikTok',       pct: 7,  color: '#f59e0b' },
                    { label: 'Other',        pct: 7,  color: '#94a3b8' },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        <span className="text-xs text-slate-600">{s.label}</span>
                      </div>
                      <span className="text-xs font-black text-slate-950">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Growth Engine banner */}
          <div
            className="rounded-2xl p-4 text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl">✦</div>
                <div>
                  <div className="flex items-center gap-2 font-black">
                    AI Growth Engine
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">New</span>
                  </div>
                  <div className="text-xs text-violet-200">Our AI is working to grow your campaigns 24/7</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                {[
                  { icon: '✨', label: 'Content Created',  value: '24',    sub: 'Posts & updates' },
                  { icon: '👥', label: 'People Reached',   value: '18,450', sub: '↑ 32% this week' },
                  { icon: '💬', label: 'Engagement',       value: '2,340',  sub: '↑ 28% this week' },
                  { icon: '🎯', label: 'New Donors',       value: '78',     sub: '↑ 22% this week' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="text-lg font-black">{s.value}</div>
                    <div className="text-[10px] text-violet-200">{s.label}</div>
                    <div className="text-[10px] text-violet-300">{s.sub}</div>
                  </div>
                ))}
              </div>
              <Link href="/ai-fundraising" className="rounded-xl border border-white/30 px-4 py-2 text-xs font-black text-white hover:bg-white/10">
                View Full Report →
              </Link>
            </div>
          </div>

        </div>

        {/* ── Right panel ── */}
        <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 xl:block">

          {/* AI Assistant */}
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <span className="text-violet-600">✦</span> AI Assistant
              </div>
              <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700">Beta</span>
            </div>
            <p className="text-xs text-slate-700 mb-4">
              I&apos;ve analyzed your campaigns and found opportunities to grow.
            </p>
            <div className="space-y-3">
              {[
                { icon: '📹', title: 'Post a video update',     body: 'Campaigns with video get 3x more donations.' },
                { icon: '👥', title: 'Re-engage past donors',   body: 'You have 78 past donors you haven\'t contacted.' },
                { icon: '🚀', title: 'Boost on social media',   body: 'Your campaign could reach 2.5x more people with a boost.' },
              ].map((s) => (
                <div key={s.title} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-base shadow-sm">{s.icon}</div>
                  <div>
                    <div className="text-xs font-black text-slate-950">{s.title}</div>
                    <div className="text-[11px] text-slate-500">{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
              ✦ Ask AI Assistant
            </button>
          </div>

          {/* Your Tasks */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black text-slate-950">Your Tasks</span>
              <Link href="/dashboard" className="text-xs font-bold text-violet-700">View all</Link>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Post campaign update',  due: 'Due today',     urgent: true  },
                { label: 'Thank new donors (12)', due: 'Due today',     urgent: true  },
                { label: 'Send update email',     due: 'Due tomorrow',  urgent: false },
                { label: 'Review AI recommendations', due: 'Due tomorrow', urgent: false },
              ].map((t) => (
                <div key={t.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300" />
                    <span className="text-xs font-bold text-slate-700">{t.label}</span>
                  </div>
                  <span className={`text-[10px] font-black ${t.urgent ? 'text-red-500' : 'text-slate-400'}`}>{t.due}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black text-slate-950">Recent Activity</span>
              <Link href="/dashboard/donor" className="text-xs font-bold text-violet-700">View all</Link>
            </div>
            <div className="space-y-3">
              {recentDonations.length > 0 ? recentDonations.map((d) => {
                const donorProfile = d.profiles as { full_name?: string } | null;
                const campaignInfo = d.campaigns as { title?: string; slug?: string } | null;
                return (
                  <div key={d.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-700">
                      {d.anonymous ? '?' : (donorProfile?.full_name ?? 'A').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-950">
                        {d.anonymous ? 'Anonymous' : (donorProfile?.full_name ?? 'Someone')} donated {formatCents(d.amount_cents)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {campaignInfo?.title ?? ''} · {new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                [{
                  icon: '👋', text: 'Your activity will appear here once donations come in.',
                }].map((a) => (
                  <div key={a.text} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base">{a.icon}</div>
                    <p className="text-xs text-slate-500">{a.text}</p>
                  </div>
                ))
              )}
              {[
                { icon: '📤', text: 'Sophia Chen shared your campaign', time: '15 min ago' },
                { icon: '✉️', text: 'You received a new message',       time: '1 hr ago' },
              ].map((a) => (
                <div key={a.text} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base">{a.icon}</div>
                  <div>
                    <div className="text-xs font-black text-slate-950">{a.text}</div>
                    <div className="text-[11px] text-slate-400">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Growth Playbook */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 text-xs font-black text-slate-950">AI Growth Playbook</div>
            <div className="space-y-1.5">
              {GROWTH_PLAYBOOK.slice(0, 3).map((item) => (
                <div key={item} className="flex items-start gap-2 text-[11px] text-slate-600">
                  <span className="mt-0.5 shrink-0 font-black text-violet-600">→</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
