import { describe, it, expect } from 'vitest';
import {
  normalizeBannerSettings,
  safeColor,
  safeFontFamily,
  DEFAULT_BANNER_SETTINGS,
  BANNER_FONT_OPTIONS,
} from '../lib/banner-settings';

// Banner appearance is set by super admins and interpolated into inline styles,
// so every value is validated on READ as well as on write. These tests pin that
// second line of defence: even a row edited directly in the database (bypassing
// the API's zod schema) must not be able to inject CSS.

describe('safeColor', () => {
  it('accepts 3- and 6-digit hex, case-insensitively', () => {
    expect(safeColor('#fff', '#000')).toBe('#fff');
    expect(safeColor('#12B76A', '#000')).toBe('#12B76A');
    expect(safeColor('  #12b76a  ', '#000')).toBe('#12b76a');
  });

  it('rejects anything that is not a hex colour', () => {
    for (const bad of [
      'red',
      'rgb(1,2,3)',
      '#12b76',
      '#12b76az',
      'url(javascript:alert(1))',
      'red; background: url(x)',
      '#fff; content: "x"',
      'expression(alert(1))',
      '',
      null,
      undefined,
      42,
      {},
    ]) {
      expect(safeColor(bad, '#000000')).toBe('#000000');
    }
  });
});

describe('safeFontFamily', () => {
  it('accepts only values from the allow-list', () => {
    for (const f of BANNER_FONT_OPTIONS) {
      expect(safeFontFamily(f.value, 'inherit')).toBe(f.value);
    }
  });

  it('rejects arbitrary font strings (CSS-injection vector)', () => {
    for (const bad of [
      'Comic Sans',
      'inherit; background: red',
      '}; body { display: none } .x {',
      'url(evil.css)',
      null,
      7,
    ]) {
      expect(safeFontFamily(bad, 'inherit')).toBe('inherit');
    }
  });
});

describe('normalizeBannerSettings', () => {
  it('returns the defaults for a missing row (migration not yet applied)', () => {
    expect(normalizeBannerSettings(null)).toEqual(DEFAULT_BANNER_SETTINGS);
    expect(normalizeBannerSettings(undefined)).toEqual(DEFAULT_BANNER_SETTINGS);
  });

  it('defaults are the AA-safe green banner', () => {
    // Was #12b76a, which gives white text only 2.62:1 — below WCAG AA (4.5:1).
    // The banner renders on every page, so that default dropped sitewide
    // Lighthouse accessibility from 100 to 94-96. #08763b is the app's AA-safe
    // green (--green-dark).
    expect(DEFAULT_BANNER_SETTINGS.backgroundColor).toBe('#08763b');
    expect(DEFAULT_BANNER_SETTINGS.textColor).toBe('#ffffff');
    expect(DEFAULT_BANNER_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_BANNER_SETTINGS.dismissible).toBe(true);
  });

  it('default banner colours clear WCAG AA for normal text', () => {
    // Guards the regression above: any future default must stay >= 4.5:1.
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    expect(ratio(DEFAULT_BANNER_SETTINGS.textColor, DEFAULT_BANNER_SETTINGS.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(DEFAULT_BANNER_SETTINGS.linkColor, DEFAULT_BANNER_SETTINGS.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });

  it('passes through a fully valid row', () => {
    const out = normalizeBannerSettings({
      enabled: false,
      background_color: '#123456',
      text_color: '#abcdef',
      link_color: '#fff',
      font_family: BANNER_FONT_OPTIONS[1].value,
      font_size_px: 18,
      title_font_size_px: 20,
      font_weight: 500,
      title_font_weight: 800,
      text_align: 'center',
      letter_spacing_em: 0.12,
      uppercase: true,
      padding_y_px: 20,
      dismissible: false,
      use_level_colors: true,
    });
    expect(out.enabled).toBe(false);
    expect(out.backgroundColor).toBe('#123456');
    expect(out.fontSizePx).toBe(18);
    expect(out.titleFontWeight).toBe(800);
    expect(out.textAlign).toBe('center');
    expect(out.uppercase).toBe(true);
    expect(out.useLevelColors).toBe(true);
  });

  it('falls back per-field when a value is hostile or out of range', () => {
    const d = DEFAULT_BANNER_SETTINGS;
    const out = normalizeBannerSettings({
      enabled: 'yes',                              // not a boolean
      background_color: 'red; background: url(x)', // CSS injection attempt
      text_color: '#zzz',
      font_family: 'Evil"); }',                    // not allow-listed
      font_size_px: 9999,                          // out of range
      title_font_size_px: -5,
      font_weight: 450,                            // not a supported weight
      text_align: 'justify',                       // unsupported
      letter_spacing_em: 99,
      padding_y_px: 1000,
    });
    expect(out.enabled).toBe(d.enabled);
    expect(out.backgroundColor).toBe(d.backgroundColor);
    expect(out.textColor).toBe(d.textColor);
    expect(out.fontFamily).toBe(d.fontFamily);
    expect(out.fontSizePx).toBe(d.fontSizePx);
    expect(out.titleFontSizePx).toBe(d.titleFontSizePx);
    expect(out.fontWeight).toBe(d.fontWeight);
    expect(out.textAlign).toBe(d.textAlign);
    expect(out.letterSpacingEm).toBe(d.letterSpacingEm);
    expect(out.paddingYPx).toBe(d.paddingYPx);
  });

  it('never emits a value containing CSS control characters', () => {
    const out = normalizeBannerSettings({
      background_color: '#fff; } body { display:none } .a {',
      text_color: 'url(javascript:alert(1))',
      font_family: 'x; behavior: url(#default#time2)',
    });
    for (const v of [out.backgroundColor, out.textColor, out.linkColor, out.fontFamily]) {
      expect(v).not.toMatch(/[;{}()]/);
    }
  });

  it('clamps a disabled banner honestly (false stays false)', () => {
    expect(normalizeBannerSettings({ enabled: false }).enabled).toBe(false);
  });
});
