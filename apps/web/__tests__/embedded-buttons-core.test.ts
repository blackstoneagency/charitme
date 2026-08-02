import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUTTON_TYPES,
  isButtonType,
  parseButtonConfig,
  toWidgetOptions,
  isValidLabel,
  requiresCampaign,
  isValidTarget,
  describeButtonType,
  DEFAULT_BUTTON_CONFIG,
  LABEL_MAX_LENGTH,
} from '../lib/embedded-buttons-core';
import { embedSnippet, WIDGET_MAX_WIDTH, WIDGET_MIN_WIDTH } from '../lib/widget-embed';

describe('button type vocabulary agrees with the database', () => {
  it('matches the CHECK constraint in the schema mirror exactly', () => {
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    const match = /embedded_buttons_button_type_check CHECK \(\(button_type = ANY \(ARRAY\[([\s\S]*?)\]\)\)\)/.exec(schema);
    expect(match, 'the CHECK constraint moved or was renamed').toBeTruthy();
    const fromSchema = [...(match![1].matchAll(/'([a-z_]+)'::text/g))].map((m) => m[1]).sort();
    expect(fromSchema).toEqual([...BUTTON_TYPES].sort());
  });

  it('accepts only those values', () => {
    expect(isButtonType('donate')).toBe(true);
    expect(isButtonType('product')).toBe(true);
    expect(isButtonType('subscribe')).toBe(false);
    expect(isButtonType(null)).toBe(false);
  });

  it('names every type, so the list view has no blank cells', () => {
    for (const type of BUTTON_TYPES) {
      expect(describeButtonType(type).length).toBeGreaterThan(0);
    }
  });
});

describe('parseButtonConfig', () => {
  it('falls back per FIELD, not per object', () => {
    // The column is `jsonb DEFAULT '{}'`, so a row written by older code is
    // missing fields. Rejecting the whole object would make an old button vanish
    // from the list rather than render with defaults.
    const partial = parseButtonConfig({ theme: 'dark' });
    expect(partial.theme).toBe('dark');
    expect(partial.width).toBe(DEFAULT_BUTTON_CONFIG.width);
    expect(partial.showCover).toBe(DEFAULT_BUTTON_CONFIG.showCover);
  });

  it('survives arbitrary jsonb', () => {
    expect(parseButtonConfig(null)).toEqual(DEFAULT_BUTTON_CONFIG);
    expect(parseButtonConfig('nope')).toEqual(DEFAULT_BUTTON_CONFIG);
    expect(parseButtonConfig([1, 2])).toEqual(DEFAULT_BUTTON_CONFIG);
    expect(parseButtonConfig({ theme: 'chartreuse' }).theme).toBe(DEFAULT_BUTTON_CONFIG.theme);
  });

  it('clamps a stored width rather than trusting the column', () => {
    expect(parseButtonConfig({ width: 99999 }).width).toBe(WIDGET_MAX_WIDTH);
    expect(parseButtonConfig({ width: 1 }).width).toBe(WIDGET_MIN_WIDTH);
  });

  it('keeps false as false rather than replacing it with the default', () => {
    // `raw[key] ?? fallback` would turn an explicit `false` into `true` here,
    // silently switching a feature back on for every saved button.
    expect(parseButtonConfig({ showCover: false }).showCover).toBe(false);
    expect(parseButtonConfig({ showProgress: false }).showProgress).toBe(false);
  });
});

describe('toWidgetOptions', () => {
  it('produces the widget’s own option shape, so there is one config not two', () => {
    const options = toWidgetOptions(DEFAULT_BUTTON_CONFIG);
    const snippet = embedSnippet('https://www.charitme.com', 'save-the-bees', 'Save the Bees', options);
    expect(snippet).toContain('src="https://www.charitme.com/campaigns/save-the-bees/embed"');
  });

  it('carries a non-default config into the snippet', () => {
    const options = toWidgetOptions({ ...DEFAULT_BUTTON_CONFIG, theme: 'dark', showCover: false, width: 300 });
    const snippet = embedSnippet('https://x.test', 'a', 'A', options);
    expect(snippet).toContain('theme=dark');
    expect(snippet).toContain('cover=0');
    expect(snippet).toContain('width="300"');
  });
});

describe('isValidLabel', () => {
  it('rejects empty and overlong labels', () => {
    expect(isValidLabel('')).toBe(false);
    expect(isValidLabel('   ')).toBe(false);
    expect(isValidLabel('Give now')).toBe(true);
    expect(isValidLabel('x'.repeat(LABEL_MAX_LENGTH))).toBe(true);
    expect(isValidLabel('x'.repeat(LABEL_MAX_LENGTH + 1))).toBe(false);
  });
});

describe('target validity', () => {
  it('requires a campaign for a donate button', () => {
    // The column is nullable because the other three types target something
    // else, so the database cannot express this. A donate button with no
    // campaign is a control that cannot take a donation — the exact dead control
    // this repo keeps finding.
    expect(requiresCampaign('donate')).toBe(true);
    expect(isValidTarget('donate', null)).toBe(false);
    expect(isValidTarget('donate', 'camp-1')).toBe(true);
  });

  it('does not require one for the other types', () => {
    for (const type of BUTTON_TYPES.filter((t) => t !== 'donate')) {
      expect(requiresCampaign(type)).toBe(false);
      expect(isValidTarget(type, null)).toBe(true);
    }
  });
});
