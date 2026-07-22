import type { Metadata } from 'next';
import { getTopCampaigns, getTopDonors } from '../../lib/leaderboard';
import LeaderboardClient from './LeaderboardClient';
import { seoMetadata } from '../../lib/seo';
import AeoContent from '../../components/AeoContent';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/leaderboard', {
    title: 'Leaderboard — Top Campaigns & Donors',
    description: 'See the top fundraising campaigns and the most generous donors in the CharitMe community.',
    alternates: { canonical: 'https://www.charitme.com/leaderboard' },
  });
}
export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const [campaigns, donors] = await Promise.all([
    getTopCampaigns(20),
    getTopDonors('all', 20),
  ]);

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>🏆 Leaderboard</h1>
        <p style={{ color: 'var(--t3)', fontSize: '15px' }}>
          Celebrating the top fundraising campaigns and the most generous donors across the CharitMe community.
        </p>
      </div>

      <LeaderboardClient initialCampaigns={campaigns} initialDonors={donors} />
      <AeoContent route="/leaderboard" title="Leaderboard questions answered" />
    </div>
  );
}
