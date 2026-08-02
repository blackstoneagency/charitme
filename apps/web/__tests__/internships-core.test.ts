import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  INTERNSHIP_CATEGORIES,
  isInternshipCategory,
  isInternship,
  placesRemaining,
  describeLocation,
} from '../lib/internships-core';

describe('there is deliberately no internships table', () => {
  it('the schema has none, and volunteer_opportunities carries what is needed', () => {
    // An internship IS a volunteer opportunity. A separate table would have
    // duplicated the listing, detail page, apply flow and admin surface, then
    // drifted from them.
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    expect(schema).not.toContain('CREATE TABLE public.internships');
    const match = /CREATE TABLE public\.volunteer_opportunities \(([\s\S]*?)\n\);/.exec(schema);
    expect(match, 'volunteer_opportunities moved').toBeTruthy();
    for (const column of ['category', 'is_remote', 'location', 'time_commitment', 'slots', 'slots_filled']) {
      expect(match![1]).toContain(column);
    }
  });

  it('no code introduces one behind our back', () => {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(full) && !full.includes('__tests__')) out.push(full);
      }
    };
    for (const root of ['app', 'lib']) walk(join(__dirname, '..', root));
    const offenders = out.filter((f) => readFileSync(f, 'utf8').includes("from('internships')"));
    expect(offenders, 'internships must stay a view over volunteer_opportunities').toEqual([]);
  });
});

describe('isInternshipCategory', () => {
  it('recognises the internship vocabulary case-insensitively', () => {
    // `category` is free text with no CHECK, so this is recognition, not
    // validation — the data will not be tidy.
    expect(isInternshipCategory('Internship')).toBe(true);
    expect(isInternshipCategory('  INTERN  ')).toBe(true);
    expect(isInternshipCategory('fellowship')).toBe(true);
  });

  it('does not sweep in ordinary volunteering', () => {
    // Broadening this to 'training' or 'education' would relabel general
    // volunteering as a career placement, which misleads applicants.
    expect(isInternshipCategory('education')).toBe(false);
    expect(isInternshipCategory('training')).toBe(false);
    expect(isInternshipCategory('community')).toBe(false);
  });

  it('handles null, undefined and blank', () => {
    expect(isInternshipCategory(null)).toBe(false);
    expect(isInternshipCategory(undefined)).toBe(false);
    expect(isInternshipCategory('   ')).toBe(false);
  });

  it('isInternship reads the category off a row', () => {
    expect(isInternship({ category: 'Internship' })).toBe(true);
    expect(isInternship({ category: 'community' })).toBe(false);
  });

  it('every listed category is lowercase, since matching normalises to lowercase', () => {
    // An uppercase entry here would be unmatchable — a silent dead rule.
    for (const category of INTERNSHIP_CATEGORIES) {
      expect(category).toBe(category.toLowerCase());
    }
  });
});

describe('placesRemaining', () => {
  it('is null when no cap was published, not 0', () => {
    // "0 places left" would stop someone applying to something still open.
    expect(placesRemaining({ category: 'internship' })).toBeNull();
    expect(placesRemaining({ category: 'internship', slots: 0 })).toBeNull();
    expect(placesRemaining({ category: 'internship', slots: null })).toBeNull();
  });

  it('subtracts filled places', () => {
    expect(placesRemaining({ category: 'internship', slots: 10, slots_filled: 4 })).toBe(6);
  });

  it('never goes negative when more were filled than published', () => {
    expect(placesRemaining({ category: 'internship', slots: 3, slots_filled: 9 })).toBe(0);
  });

  it('treats a missing or nonsense filled count as zero filled', () => {
    expect(placesRemaining({ category: 'internship', slots: 5 })).toBe(5);
    expect(placesRemaining({ category: 'internship', slots: 5, slots_filled: -2 })).toBe(5);
  });
});

describe('describeLocation', () => {
  it('combines remote with a named base', () => {
    expect(describeLocation({ category: 'internship', is_remote: true, location: 'London, UK' }))
      .toBe('Remote · London, UK');
  });

  it('says Remote when there is no base', () => {
    expect(describeLocation({ category: 'internship', is_remote: true })).toBe('Remote');
  });

  it('says the location when it is on-site', () => {
    expect(describeLocation({ category: 'internship', location: 'Nairobi' })).toBe('Nairobi');
  });

  it('does not guess on-site when nothing was stated', () => {
    // Guessing would put off a remote applicant for a role that may be remote.
    expect(describeLocation({ category: 'internship' })).toBe('Location not stated');
    expect(describeLocation({ category: 'internship', location: '   ' })).toBe('Location not stated');
  });
});
