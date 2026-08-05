import { getCampaigns, getStories, getImpactStats } from '@/lib/queries';
import { Hero, ImpactBand, Tabs, CampaignGrid, Helps, Stories, CtaBand } from '@/components/Sections';

/**
 * /causes/sports-youth — a Server Component.
 *
 * No client JS on this page at all: every section is content and links, and it
 * is a common entry point from a shared link, where a client bundle costs LCP.
 *
 * The three reads run concurrently — they are independent, and serialising them
 * would make the slowest one the sum of all three.
 */
export const revalidate = 60;

export default async function SportsYouthPage() {
  const [campaigns, stories, stats] = await Promise.all([
    getCampaigns(3),
    getStories(3),
    getImpactStats(),
  ]);

  return (
    <main id="main">
      <Hero />
      <ImpactBand stats={stats} />
      <Tabs />
      <CampaignGrid campaigns={campaigns.error ? null : campaigns.data} />
      <div className="text-center">
        <a href="/campaigns?cause=sports-youth"
           className="inline-flex min-h-[44px] items-center rounded-card border border-line-strong px-6 text-sm font-bold text-ink transition-colors hover:bg-surface-2">
          See more campaigns
        </a>
      </div>
      <Helps />
      <Stories stories={stories.error ? null : stories.data} />
      <CtaBand />
    </main>
  );
}
