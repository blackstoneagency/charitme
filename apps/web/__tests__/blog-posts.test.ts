import { describe, it, expect } from 'vitest';
import { BLOG_POSTS, getBlogPost, getAllBlogSlugs, type BlogBlock } from '../lib/blog-posts';

// These posts back statically-generated /blog/[slug] routes (generateStaticParams
// → getAllBlogSlugs). A duplicate slug or malformed record would collide routes
// or break a page at build/render time, so guard the collection's integrity.

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BLOCK_TYPES = new Set(['p', 'h2', 'h3', 'quote', 'ul']);

describe('blog content integrity', () => {
  it('has at least one post', () => {
    expect(BLOG_POSTS.length).toBeGreaterThan(0);
  });

  it('every slug is unique', () => {
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size, 'duplicate slug(s) would collide static routes').toBe(slugs.length);
  });

  it('every slug is URL-safe (kebab-case)', () => {
    for (const p of BLOG_POSTS) {
      expect(SLUG_RE.test(p.slug), `bad slug: ${p.slug}`).toBe(true);
    }
  });

  it('every post has the required non-empty text fields', () => {
    for (const p of BLOG_POSTS) {
      expect(p.title.trim().length, `${p.slug} title`).toBeGreaterThan(0);
      expect(p.category.trim().length, `${p.slug} category`).toBeGreaterThan(0);
      expect(p.excerpt.trim().length, `${p.slug} excerpt`).toBeGreaterThan(0);
    }
  });

  it('every publishedAt is a valid ISO date', () => {
    for (const p of BLOG_POSTS) {
      expect(ISO_DATE_RE.test(p.publishedAt), `${p.slug} date: ${p.publishedAt}`).toBe(true);
      expect(Number.isNaN(Date.parse(p.publishedAt)), `${p.slug} unparseable date`).toBe(false);
    }
  });

  it('readTimeMinutes is a positive integer', () => {
    for (const p of BLOG_POSTS) {
      expect(Number.isInteger(p.readTimeMinutes) && p.readTimeMinutes > 0, `${p.slug} readTime`).toBe(true);
    }
  });

  it('every content block is well-formed for its type', () => {
    const nonEmpty = (b: BlogBlock) => {
      expect(BLOCK_TYPES.has(b.type), `unknown block type: ${(b as { type: string }).type}`).toBe(true);
      if (b.type === 'ul') {
        expect(b.items.length, 'empty ul').toBeGreaterThan(0);
        for (const item of b.items) expect(item.trim().length).toBeGreaterThan(0);
      } else {
        expect(b.text.trim().length, `empty ${b.type} text`).toBeGreaterThan(0);
      }
    };
    for (const p of BLOG_POSTS) {
      expect(p.content.length, `${p.slug} has no content`).toBeGreaterThan(0);
      p.content.forEach(nonEmpty);
    }
  });

  it('every CTA has a label and an internal href', () => {
    for (const p of BLOG_POSTS) {
      expect(p.cta.label.trim().length, `${p.slug} cta label`).toBeGreaterThan(0);
      expect(p.cta.href.startsWith('/'), `${p.slug} cta href should be internal: ${p.cta.href}`).toBe(true);
    }
  });
});

describe('getBlogPost / getAllBlogSlugs', () => {
  it('getAllBlogSlugs returns exactly the post slugs', () => {
    expect(getAllBlogSlugs().sort()).toEqual(BLOG_POSTS.map((p) => p.slug).sort());
  });

  it('getBlogPost resolves every published slug', () => {
    for (const slug of getAllBlogSlugs()) {
      expect(getBlogPost(slug)?.slug).toBe(slug);
    }
  });

  it('getBlogPost returns undefined for an unknown slug', () => {
    expect(getBlogPost('no-such-post')).toBeUndefined();
  });
});
