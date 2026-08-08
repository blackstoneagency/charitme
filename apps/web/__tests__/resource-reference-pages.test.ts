import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = resolve(__dirname, '..');
const read = (path: string): string => readFileSync(join(WEB, path), 'utf8');

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const pages = {
  corporate: read('app/corporate-partnerships/page.tsx'),
  matching: read('app/matching/(list)/page.tsx'),
  grants: read('app/grants/page.tsx'),
};

describe('reference resource pages', () => {
  it.each([
    ['corporate', 'public/images/reference/corporate-partnerships-hero.webp'],
    ['matching', 'public/images/reference/matching-gifts-hero.webp'],
    ['grants', 'public/images/reference/grants-hero.webp'],
  ] as const)('%s uses a production-sized local hero image', (page, imagePath) => {
    expect(pages[page]).toContain(`/${imagePath.replace('public/', '')}`);
    const absolute = join(WEB, imagePath);
    expect(existsSync(absolute)).toBe(true);
    expect(statSync(absolute).size).toBeGreaterThan(50_000);
  });

  it('keeps corporate partners connected to the public Supabase roster', () => {
    expect(pages.corporate).toContain("import PartnerRoster from '../partner/PartnerRoster'");
    expect(pages.corporate).toContain('<PartnerRoster />');
    expect(read('app/partner/PartnerRoster.tsx')).toContain('getPublicSponsors()');
  });

  it('renders employer matching search from active Supabase programs', () => {
    expect(pages.matching).toContain("import { listActivePrograms } from '../../../lib/matching'");
    expect(pages.matching).toContain('await listActivePrograms(query || undefined).catch(() => [])');
    expect(pages.matching).toContain('programs.map((program)');
  });

  it('renders searchable grant opportunities from Supabase', () => {
    expect(pages.grants).toContain('getPublicGrants(48)');
    expect(pages.grants).toContain('getGrantCategories()');
    expect(pages.grants).toContain('<GrantsClient initialGrants={grants} categories={categories} />');
  });

  it('shares the responsive light-body reference system', () => {
    const component = read('components/ReferenceMarketing.tsx');
    const css = read('app/globals.css');
    expect(Object.values(pages).every((page) => page.includes('className="rr-page'))).toBe(true);
    expect(component).toContain('highlights?: ReferenceFeature[]');
    expect(css).toContain('.rr-band-light');
    expect(css).toContain('@media (max-width: 619px)');
  });

  it('keeps the employer-search helper above the WCAG AA contrast threshold', () => {
    const css = read('app/globals.css');
    const foreground = css.match(/\.rr-employer-search small \{[^}]*color:\s*(#[0-9a-f]{6})/i)?.[1];
    const background = css.match(/\.rr-employer-panel \{[^}]*background:\s*(#[0-9a-f]{6})/i)?.[1];

    expect(foreground).toBeDefined();
    expect(background).toBeDefined();
    expect(contrastRatio(foreground ?? '#000000', background ?? '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
