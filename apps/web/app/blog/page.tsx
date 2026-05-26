import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'KindFund fundraising guides, AI tips, donor trust insights, and campaign growth playbooks.',
};

const posts = [
  ['AI Fundraising', 'How to write a campaign story donors trust', 'Use structure, proof, and emotion to help supporters understand the need quickly.'],
  ['Growth', 'Five updates that keep donations moving', 'A practical playbook for keeping supporters engaged after launch day.'],
  ['Trust & Safety', 'What donors look for before giving', 'Clear identity, transparent goals, and public updates make every campaign stronger.'],
];

export default function BlogPage() {
  return (
    <div className="pub-page simple-public">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Blog</b></div>
        <h1>Fundraising ideas, AI playbooks, and trust-building guides.</h1>
        <p>Practical resources for organizers, nonprofits, teams, and donors who want every campaign to perform better and feel safer.</p>
      </section>
      <section className="blog-grid">
        {posts.map(([tag, title, body]) => (
          <article key={title}>
            <span>{tag}</span>
            <h2>{title}</h2>
            <p>{body}</p>
            <Link href="/how-it-works">Read article <PublicIcon name="arrow" /></Link>
          </article>
        ))}
      </section>
    </div>
  );
}
