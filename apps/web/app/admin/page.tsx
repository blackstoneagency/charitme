import { requireUser } from '../../lib/auth';
import { isAdmin } from '../../lib/roles';
import { supabaseAdmin } from '../../lib/supabase';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await requireUser();
  const allowed = await isAdmin(user.id, user.email);
  if (!allowed) {
    return <div className="container py-16"><h1 className="text-3xl font-black">Admin access required</h1></div>;
  }

  const [campaigns, donations, payouts, flags, reviews] = await Promise.all([
    supabaseAdmin.from('campaigns').select('id,title,status,created_at').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('donations').select('id,amount_cents,status,created_at').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('payouts').select('id,amount_cents,status,payout_speed,created_at').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('risk_flags').select('id,label,severity,status,created_at').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('admin_reviews').select('id,review_type,status,created_at').order('created_at', { ascending: false }).limit(20),
  ]);

  return (
    <div className="bg-slate-50 py-10">
      <div className="container">
        <h1 className="text-4xl font-black text-slate-950">Admin console</h1>
        <p className="mt-2 text-slate-600">Risk review, moderation, payouts, refunds, reports, trust scores, and webhook visibility.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {[
            ['Campaigns', campaigns.data?.length ?? 0],
            ['Donations', donations.data?.length ?? 0],
            ['Payouts', payouts.data?.length ?? 0],
            ['Risk flags', flags.data?.length ?? 0],
            ['Reviews', reviews.data?.length ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-3xl font-black text-emerald-700">{value}</div>
              <div className="mt-1 text-sm font-bold text-slate-600">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <AdminList title="Risk review queue" rows={(flags.data ?? []).map((row) => `${row.severity}: ${row.label} (${row.status})`)} />
          <AdminList title="Payout controls" rows={(payouts.data ?? []).map((row) => `${row.payout_speed} payout - ${row.status}`)} />
          <AdminList title="Campaign moderation" rows={(campaigns.data ?? []).map((row) => `${row.title} - ${row.status}`)} />
          <AdminList title="Webhook events and reviews" rows={(reviews.data ?? []).map((row) => `${row.review_type} - ${row.status}`)} />
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
        {(rows.length ? rows : ['No records yet']).map((row) => <div key={row} className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{row}</div>)}
      </div>
    </div>
  );
}
