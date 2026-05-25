import { requireUser } from '../../lib/auth';
import { isAdmin } from '../../lib/roles';
import { supabaseAdmin } from '../../lib/supabase';

export const dynamic = 'force-dynamic';

type CampaignRow  = { id: string; title: string; status: string; created_at: string };
type DonationRow  = { id: string; amount_cents: number; status: string; created_at: string };
type PayoutRow    = { id: string; amount_cents: number; status: string; payout_speed: string; created_at: string };
type FlagRow      = { id: string; label: string; severity: string; status: string; created_at: string };
type ReviewRow    = { id: string; review_type: string; status: string; created_at: string };

async function fetchCampaigns(): Promise<CampaignRow[]> {
  try {
    const { data } = await supabaseAdmin.from('campaigns').select('id,title,status,created_at').order('created_at', { ascending: false }).limit(20);
    return (data ?? []) as CampaignRow[];
  } catch { return []; }
}
async function fetchDonations(): Promise<DonationRow[]> {
  try {
    const { data } = await supabaseAdmin.from('donations').select('id,amount_cents,status,created_at').order('created_at', { ascending: false }).limit(20);
    return (data ?? []) as DonationRow[];
  } catch { return []; }
}
async function fetchPayouts(): Promise<PayoutRow[]> {
  try {
    const { data } = await supabaseAdmin.from('payouts').select('id,amount_cents,status,payout_speed,created_at').order('created_at', { ascending: false }).limit(20);
    return (data ?? []) as PayoutRow[];
  } catch { return []; }
}
async function fetchFlags(): Promise<FlagRow[]> {
  try {
    const { data } = await supabaseAdmin.from('risk_flags').select('id,label,severity,status,created_at').order('created_at', { ascending: false }).limit(20);
    return (data ?? []) as FlagRow[];
  } catch { return []; }
}
async function fetchReviews(): Promise<ReviewRow[]> {
  try {
    const { data } = await supabaseAdmin.from('admin_reviews').select('id,review_type,status,created_at').order('created_at', { ascending: false }).limit(20);
    return (data ?? []) as ReviewRow[];
  } catch { return []; }
}

export default async function AdminPage() {
  const user = await requireUser();
  const allowed = await isAdmin(user.id, user.email);
  if (!allowed) {
    return <div className="container py-16"><h1 className="text-3xl font-black">Admin access required</h1></div>;
  }

  const [campaigns, donations, payouts, flags, reviews] = await Promise.all([
    fetchCampaigns(),
    fetchDonations(),
    fetchPayouts(),
    fetchFlags(),
    fetchReviews(),
  ]);

  return (
    <div className="bg-slate-50 py-10">
      <div className="container">
        <h1 className="text-4xl font-black text-slate-950">Admin console</h1>
        <p className="mt-2 text-slate-600">Risk review, moderation, payouts, refunds, reports, trust scores, and webhook visibility.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {[
            ['Campaigns', campaigns.length],
            ['Donations', donations.length],
            ['Payouts', payouts.length],
            ['Risk flags', flags.length],
            ['Reviews', reviews.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-3xl font-black text-emerald-700">{value}</div>
              <div className="mt-1 text-sm font-bold text-slate-600">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <AdminList title="Risk review queue" rows={flags.map((r) => `${r.severity}: ${r.label} (${r.status})`)} />
          <AdminList title="Payout controls" rows={payouts.map((r) => `${r.payout_speed} payout — ${r.status}`)} />
          <AdminList title="Campaign moderation" rows={campaigns.map((r) => `${r.title} — ${r.status}`)} />
          <AdminList title="Webhook events and reviews" rows={reviews.map((r) => `${r.review_type} — ${r.status}`)} />
        </div>
      </div>
    </div>
  );
}

function AdminList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-4 space-y-2">
        {(rows.length ? rows : ['No records yet']).map((row) => (
          <div key={row} className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{row}</div>
        ))}
      </div>
    </div>
  );
}
