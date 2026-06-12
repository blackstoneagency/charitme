import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';
import { BLOG_POSTS } from '../../lib/blog-posts';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'CharitMe fundraising guides, AI tips, donor trust insights, and campaign growth playbooks.',
  alternates: { canonical: 'https://www.charitme.com/blog' },
};

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default function BlogPage() {
  return (
    <div className="pub-page simple-public">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Blog</b></div>
        <h1>Fundraising ideas, AI playbooks, and trust-building guides.</h1>
        <p>Practical resources for organizers, nonprofits, teams, and donors who want every campaign to perform better and feel safer.</p>
      </section>
      <section className="blog-grid">
        {BLOG_POSTS.map(({ slug, category, title, excerpt, publishedAt, readTimeMinutes }) => (
          <article key={slug}>
            <span>{category}</span>
            <h2>{title}</h2>
            <p>{excerpt}</p>
            <p className="blog-meta">{dateFmt.format(new Date(`${publishedAt}T00:00:00`))} · {readTimeMinutes} min read</p>
            <Link href={`/blog/${slug}`}>Read article <PublicIcon name="arrow" /></Link>
          </article>
        ))}
      </section>
    </div>
  );
}
