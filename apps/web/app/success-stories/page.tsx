import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';

export const metadata: Metadata = {
  title: 'Success Stories',
  description: 'Real KindFund success stories from fundraisers and communities creating impact.',
};

const stories = [
  ['Education', 'student', 'Help Sarah Fund Her College', 'With the support of 842 donors, Sarah raised $28,450 for her higher education.', '842', '$28,450', 'May 10, 2024'],
  ['Medical', 'medical', 'Save Liam\'s Heart Surgery', 'A community came together to help Liam get life-saving surgery.', '1,245', '$65,120', 'Apr 22, 2024'],
  ['Community', 'community', 'Clean Water for Rural Villages', 'Raised $42,300 to provide clean drinking water to 7 villages.', '967', '$42,300', 'Apr 15, 2024'],
  ['Animal Welfare', 'dog', 'Rescue Shelter Expansion', 'Thanks to 610 donors, the shelter expanded and saved 300+ animals.', '610', '$18,760', 'Mar 30, 2024'],
];

const filters = ['All Stories', 'Individuals', 'Nonprofits', 'Communities', 'Emergencies'];

export default function SuccessStoriesPage() {
  return (
    <div className="pub-page">
      <section className="stories-hero">
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Success Stories</b></div>
        <div className="stories-hero-grid">
          <div>
            <h1>Real people. Real stories. Real <em>impact.</em></h1>
            <p>See how individuals, nonprofits and communities achieved their goals with KindFund.</p>
            <div className="pub-actions">
              <Link href="/login?mode=signup" className="pub-btn primary">Share Your Story <PublicIcon name="edit" /></Link>
              <a href="#stories" className="pub-btn secondary">Browse All Stories <PublicIcon name="arrow" /></a>
            </div>
          </div>
          <div className="stories-collage">
            <div className="story-photo cheering" />
            <div className="story-photo donation" />
            <div className="story-message">Together,<br />we create <em>change.</em></div>
            <div className="story-stats">
              <Stat icon="users" value="320,000+" label="Campaigns Created" />
              <Stat icon="dollar" value="$48M+" label="Raised" />
              <Stat icon="heart" value="2.1M+" label="Donors" />
              <Stat icon="globe" value="180+" label="Countries" />
            </div>
          </div>
        </div>
      </section>

      <section id="stories" className="story-browser">
        <div className="story-filters">
          <span>Filter by</span>
          {filters.map((filter, index) => <button className={index === 0 ? 'active' : ''} key={filter}><PublicIcon name={index === 0 ? 'ai' : index === 1 ? 'users' : index === 2 ? 'tag' : index === 3 ? 'globe' : 'shield'} /> {filter}</button>)}
          <label><PublicIcon name="search" /><input placeholder="Search stories..." /></label>
          <select defaultValue="Latest"><option>Latest</option><option>Most Raised</option></select>
        </div>
        <div className="story-grid">
          {stories.map(([category, image, title, body, donors, raised, date]) => (
            <article className="story-card" key={title}>
              <div className={`story-card-img ${image}`}><span>{category}</span><button aria-label="Save story"><PublicIcon name="heart" /></button></div>
              <h2>{title}</h2>
              <p>{body}</p>
              <div className="story-meta">
                <span><PublicIcon name="users" /><b>{donors}</b><small>Donors</small></span>
                <span><PublicIcon name="dollar" /><b>{raised}</b><small>Raised</small></span>
                <span><PublicIcon name="calendar" /><b>{date}</b></span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="story-bottom">
        <div className="story-quotes">
          <h2>What our fundraisers say</h2>
          {['KindFund made it so easy to share my story and reach people who truly care.', 'The tools and support helped us raise funds faster and make a bigger impact.', 'Our community felt connected every step of the way.'].map((quote, index) => (
            <article key={quote}><span>&quot;</span><p>{quote}</p><b>- {['Emily Johnson', 'Michael Torres', 'Aisha Patel'][index]}</b></article>
          ))}
        </div>
        <div className="community-impact">
          <h2>Our Community Impact</h2>
          <Stat icon="heart" value="320,000+" label="Stories Shared" />
          <Stat icon="users" value="2.1M+" label="Lives Impacted" />
          <Stat icon="dollar" value="$48M+" label="Raised Together" />
          <Stat icon="globe" value="180+" label="Countries Reached" />
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return <article><span><PublicIcon name={icon} /></span><b>{value}</b><small>{label}</small></article>;
}
