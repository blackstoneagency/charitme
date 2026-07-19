import Link from 'next/link';
import { safeJsonLd } from "../../../lib/json-ld";
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicIcon } from '../../../components/PublicIcon';
import { BLOG_POSTS, getBlogPost, getAllBlogSlugs, type BlogBlock } from '../../../lib/blog-posts';

const BASE = 'https://www.charitme.com';
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: 'Article not found' };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `${BASE}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      url: `${BASE}/blog/${post.slug}`,
      publishedTime: post.publishedAt,
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.excerpt },
  };
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case 'h2': return <h2>{block.text}</h2>;
    case 'h3': return <h3>{block.text}</h3>;
    case 'quote': return <blockquote>{block.text}</blockquote>;
    case 'ul': return <ul>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
    default: return <p>{block.text}</p>;
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    articleSection: post.category,
    url: `${BASE}/blog/${post.slug}`,
    publisher: { '@type': 'Organization', name: 'CharitMe', url: BASE },
    author: { '@type': 'Organization', name: 'CharitMe' },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${BASE}/blog/${post.slug}` },
    ],
  };

  return (
    <div className="pub-page simple-public blog-post">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <section className="blog-post-header">
        <div className="pub-breadcrumb">
          <Link href="/">Home</Link> <span>&gt;</span> <Link href="/blog">Blog</Link> <span>&gt;</span> <b>{post.title}</b>
        </div>
        <span className="blog-post-tag">{post.category}</span>
        <h1>{post.title}</h1>
        <p className="blog-meta">{dateFmt.format(new Date(`${post.publishedAt}T00:00:00`))} · {post.readTimeMinutes} min read</p>
      </section>

      <section className="blog-post-body">
        {post.content.map((block, i) => <Block key={i} block={block} />)}

        <div className="blog-post-cta">
          <h3>Ready to put this into practice?</h3>
          <Link href={post.cta.href} className="pub-btn primary">{post.cta.label} <PublicIcon name="arrow" /></Link>
        </div>
      </section>

      <section className="blog-related">
        <h2>Keep reading</h2>
        <div className="blog-related-grid blog-grid">
          {related.map((r) => (
            <article key={r.slug}>
              <span>{r.category}</span>
              <h2>{r.title}</h2>
              <p>{r.excerpt}</p>
              <Link href={`/blog/${r.slug}`}>Read article <PublicIcon name="arrow" /></Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
