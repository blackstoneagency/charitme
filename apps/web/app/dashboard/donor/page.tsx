import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { formatCents } from '../../../lib/stripe';

export const dynamic = 'force-dynamic';

export default async function DonorDashboardPage() {
  const user = await requireUser();
  const { data: donations } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, created_at, campaigns(title, slug)')
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="container py-10">
      <h1 className="text-4xl font-black">Donor dashboard</h1>
      <p className="mt-2 text-slate-600">Donation history, receipts, impact updates, followed campaigns, and suggested trusted causes.</p>
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">Donation history</h2>
        <div className="mt-4 space-y-3">
          {(donations ?? []).map((donation) => {
            const campaign = donation.campaigns as { title?: string; slug?: string } | null;
            return (
              <div key={donation.id} className="flex justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <div className="font-black">{campaign?.title ?? 'Campaign'}</div>
                  <div className="text-sm text-slate-500">{new Date(donation.created_at).toLocaleDateString()}</div>
                </div>
                <div className="font-black text-emerald-700">{formatCents(donation.amount_cents)}</div>
              </div>
            );
          })}
          {(!donations || donations.length === 0) && <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">No donations yet.</div>}
        </div>
      </div>
    </div>
  );
}
