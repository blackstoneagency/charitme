import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ReferenceCardGrid,
  ReferenceCta,
  ReferenceHero,
  ReferencePage,
  ReferenceSection,
} from '../../components/ReferenceMarketing';
import { BLOG_POSTS } from '../../lib/blog-posts';
import { getPhotosForCategory } from '../../lib/photo-catalog';

export const metadata: Metadata = {
  title: 'CharitMe Blog',
  description: 'Fundraising guidance, donor trust insights, impact stories, nonprofit resources, and practical ideas from CharitMe.',
  alternates: { canonical: 'https://www.charitme.com/blog' },
};

const TOPICS = [
  { label: 'All Topics', href: '/blog' },
  { label: 'Fundraising Tips', href: '/blog?topic=fundraising' },
  { label: 'Nonprofit Growth', href: '/blog?topic=nonprofit' },
  { label: 'Impact Stories', href: '/success-stories' },
  { label: 'Community', href: '/blog?topic=community' },
  { label: 'Giving Back', href: '/blog?topic=giving' },
  { label: 'Events', href: '/events' },
  { label: 'Platform Updates', href: '/blog?topic=platform' },
];

export default function BlogPage() {
  const photos = getPhotosForCategory('Community', Math.max(BLOG_POSTS.length + 1, 6));
  const posts = BLOG_POSTS.map((post, index) => ({
    icon: 'book',
    title: post.title,
    body: post.excerpt,
    action: `${post.readTimeMinutes} min read`,
    href: `/blog/${post.slug}`,
    image: photos[index + 1] ?? photos[0],
  }));

  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Blog' }]}
        eyebrow=""
        title={<>CharitMe Blog</>}
        lede="Real stories, expert tips, and insights to inspire and equip changemakers like you."
        search={{ action: '/search', placeholder: 'Search blog articles...', hidden: [{ name: 'type', value: 'resources' }] }}
        image="/images/reference/blog-hero.jpg"
        imageAlt="Many hands protecting a young seedling"
        variant="catalog"
      />

      <div className="rp-section rp-section-compact">
        <nav className="rp-topic-pills" aria-label="Blog topics">
          {TOPICS.map((topic) => <Link key={topic.label} href={topic.href}>{topic.label}</Link>)}
        </nav>
      </div>

      <div id="latest">
        <ReferenceSection title="Latest Articles">
          <div className="rp-content-rail">
            <ReferenceCardGrid items={posts} columns={3} />
            <aside className="rp-side-panel" aria-label="Popular articles">
              <h3>Popular Articles</h3>
              <ol>
                {posts.slice(0, 5).map((post, index) => (
                  <li key={post.title}><Link href={post.href}><span>{index + 1}. {post.title}</span><small>{post.action}</small></Link></li>
                ))}
              </ol>
            </aside>
          </div>
        </ReferenceSection>
      </div>

      <ReferenceCta
        icon="mail"
        title="Stay Inspired"
        body="Get practical fundraising ideas and impact stories delivered through the CharitMe newsletter."
        actions={[
          { label: 'Join the Newsletter', href: '/newsletter' },
          { label: 'Explore Resources', href: '/resources', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
