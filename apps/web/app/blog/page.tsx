import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'KindFund fundraising guides, AI tips, donor trust insights, and campaign growth playbooks.',
};

const posts = [
  { tag: 'AI Fundraising', title: 'How to write a campaign story donors trust', body: 'Use structure, proof, and emotion to help supporters understand the need quickly.', href: '/how-it-works' },
  { tag: 'Growth', title: 'Five updates that keep donations moving', body: 'A practical playbook for keeping supporters engaged after launch day.', href: '/features' },
  { tag: 'Trust & Safety', title: 'What donors look for before giving', body: 'Clear identity, transparent goals, and public updates make every campaign stronger.', href: '/trust-safety' },
  { tag: 'Nonprofits', title: 'Recurring donations for nonprofits', body: 'How to turn one-time supporters into long-term recurring donors with KindFund.', href: '/for-nonprofits' },
  { tag: 'Payouts', title: 'How fast payouts work on KindFund', body: 'Standard, same-day, and instant payout options explained — and how to qualify.', href: '/fast-payouts' },
  { tag: 'Donors', title: 'Trust signals every donor should check', body: 'Five things to look for before donating to any online fundraiser.', href: '/for-donors' },
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
        {posts.map(({ tag, title, body, href }) => (
          <article key={title}>
            <span>{tag}</span>
            <h2>{title}</h2>
            <p>{body}</p>
            <Link href={href}>Read article <PublicIcon name="arrow" /></Link>
          </article>
        ))}
      </section>
    </div>
  );
}
