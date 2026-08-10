'use client';

import React, { useMemo, useState } from 'react';
import type { BannerSettings } from '../../../../lib/banner-settings';

const card: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: '18px 22px', marginBottom: 16 };
const btn: React.CSSProperties = { padding: '10px 20px', background: '#6c35ff', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '9px 16px', background: 'var(--s2)', color: 'var(--t1)', border: '1px solid var(--b1)', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 6 };
const field: React.CSSProperties = { padding: '9px 12px', borderRadius: 9, border: '1px solid var(--b1)', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: 'var(--s1)', color: 'var(--t1)' };
const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 };

type FontOption = { label: string; value: string };

export default function BannerClient({
  initial, fonts, weights,
}: { initial: BannerSettings; fonts: FontOption[]; weights: number[] }) {
  const [s, setS] = useState<BannerSettings>(initial);
  const [saved, setSaved] = useState<BannerSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const set = <K extends keyof BannerSettings>(k: K, v: BannerSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const dirty = useMemo(() => JSON.stringify(s) !== JSON.stringify(saved), [s, saved]);

  const save = async () => {
    setBusy(true); setNotice('');
    try {
      const res = await fetch('/api/admin/super/banner', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // snake_case keys match the API schema / DB columns
        body: JSON.stringify({
          enabled: s.enabled,
          content_title: s.contentTitle,
          content_body: s.contentBody,
          content_link_label: s.contentLinkLabel,
          content_link_url: s.contentLinkUrl,
          background_color: s.backgroundColor,
          text_color: s.textColor,
          link_color: s.linkColor,
          font_family: s.fontFamily,
          font_size_px: s.fontSizePx,
          title_font_size_px: s.titleFontSizePx,
          font_weight: s.fontWeight,
          title_font_weight: s.titleFontWeight,
          text_align: s.textAlign,
          letter_spacing_em: s.letterSpacingEm,
          uppercase: s.uppercase,
          padding_y_px: s.paddingYPx,
          dismissible: s.dismissible,
          use_level_colors: s.useLevelColors,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error ?? 'Save failed');
      setS(j.settings); setSaved(j.settings);
      setNotice('✅ Saved — the banner is updated across the site.');
    } catch (e) {
      setNotice(`❌ ${e instanceof Error ? e.message : 'Could not save.'}`);
    } finally {
      setBusy(false);
      setTimeout(() => setNotice(''), 6000);
    }
  };

  return (
    <div style={{ padding: '0 24px 48px', maxWidth: 940 }}>
      {notice && (
        <div role="status" style={{ ...card, padding: '12px 18px', fontWeight: 700, fontSize: 13,
          background: notice.startsWith('❌') ? '#fff0f3' : '#f0fdf4',
          borderColor: notice.startsWith('❌') ? '#fecdd3' : '#bbf7d0',
          color: notice.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)' }}>
          {notice}
        </div>
      )}

      {/* ── Live preview ── */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 4 }}>Live preview</div>
        <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 12 }}>
          Exactly how the bar renders on the public site with your current settings.
        </div>
        <div style={{ border: '1px solid #eef0f7', borderRadius: 10, overflow: 'hidden' }}>
          {s.enabled ? (
            <div style={{ background: s.useLevelColors ? 'linear-gradient(90deg,#0f9d58,#19b86a)' : s.backgroundColor, color: s.textColor }}>
              <div style={{
                maxWidth: 1200, margin: '0 auto', padding: `${s.paddingYPx}px 16px`,
                display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, flexWrap: 'wrap',
                justifyContent: s.textAlign === 'center' ? 'center' : s.textAlign === 'right' ? 'flex-end' : 'flex-start',
                fontSize: s.fontSizePx, fontFamily: s.fontFamily, fontWeight: s.fontWeight,
                letterSpacing: s.letterSpacingEm ? `${s.letterSpacingEm}em` : undefined,
                textTransform: s.uppercase ? 'uppercase' : undefined,
              }}>
                <strong style={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere', fontWeight: s.titleFontWeight, fontSize: s.titleFontSizePx }}>
                  {s.contentTitle || 'Latest active announcement'}
                </strong>
                <span style={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere', opacity: 0.92 }}>
                  {s.contentBody || 'Custom copy is blank, so the newest active announcement will appear here.'}
                </span>
                {(s.contentLinkUrl || s.contentLinkLabel) && (
                  <a href="#preview" onClick={(e) => e.preventDefault()} style={{ color: s.linkColor, fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                    {s.contentLinkLabel || 'Learn more'} →
                  </a>
                )}
                {s.dismissible && <span style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.85, fontSize: 18, lineHeight: 1 }}>×</span>}
              </div>
            </div>
          ) : (
            <div style={{ padding: '18px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 13, fontWeight: 600, background: 'var(--s2)' }}>
              Banner is hidden site-wide.
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 4 }}>Banner text</div>
        <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 14 }}>
          Saved copy appears site-wide immediately. Leave the title blank to use the newest active announcement instead.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
          <div>
            <label htmlFor="banner-title" style={label}>Title</label>
            <input
              id="banner-title"
              value={s.contentTitle}
              maxLength={120}
              onChange={(e) => set('contentTitle', e.target.value)}
              placeholder="New: AI Growth Plan is live"
              style={field}
            />
          </div>
          <div>
            <label htmlFor="banner-body" style={label}>Message</label>
            <textarea
              id="banner-body"
              value={s.contentBody}
              maxLength={240}
              rows={3}
              onChange={(e) => set('contentBody', e.target.value)}
              placeholder="Tell visitors what changed and why it matters."
              style={{ ...field, resize: 'vertical' }}
            />
          </div>
          <div style={row}>
            <div>
              <label htmlFor="banner-link-label" style={label}>Link label</label>
              <input
                id="banner-link-label"
                value={s.contentLinkLabel}
                maxLength={60}
                onChange={(e) => set('contentLinkLabel', e.target.value)}
                placeholder="Learn more"
                style={field}
              />
            </div>
            <div>
              <label htmlFor="banner-link-url" style={label}>Link URL</label>
              <input
                id="banner-link-url"
                value={s.contentLinkUrl}
                maxLength={500}
                onChange={(e) => set('contentLinkUrl', e.target.value)}
                placeholder="/features or https://..."
                style={field}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Visibility ── */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 12 }}>Visibility</div>
        <Toggle
          checked={s.enabled}
          onChange={(v) => set('enabled', v)}
          title="Show the banner across the site"
          hint="Off hides it everywhere immediately, no matter how many announcements are active."
        />
        <Toggle
          checked={s.dismissible}
          onChange={(v) => set('dismissible', v)}
          title="Let visitors dismiss it"
          hint="When off, the × is hidden and the banner stays until you turn it off here."
        />
        <Toggle
          checked={s.useLevelColors}
          onChange={(v) => set('useLevelColors', v)}
          title="Use each announcement's severity colour"
          hint="Overrides the background below so a critical alert still reads as critical."
        />
      </div>

      {/* ── Colours ── */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 12 }}>Colours</div>
        <div style={row}>
          <ColorField id="bg" label="Background" value={s.backgroundColor} onChange={(v) => set('backgroundColor', v)} disabled={s.useLevelColors} />
          <ColorField id="fg" label="Text" value={s.textColor} onChange={(v) => set('textColor', v)} />
          <ColorField id="lk" label="Link" value={s.linkColor} onChange={(v) => set('linkColor', v)} />
        </div>
        {s.useLevelColors && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--t3)' }}>
            Background is controlled by each announcement&rsquo;s severity while that option is on.
          </p>
        )}
      </div>

      {/* ── Typography ── */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 12 }}>Typography</div>
        <div style={row}>
          <div>
            <label htmlFor="ff" style={label}>Font</label>
            <select id="ff" value={s.fontFamily} onChange={(e) => set('fontFamily', e.target.value)} style={field}>
              {fonts.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <NumField id="ts" label="Title size (px)" value={s.titleFontSizePx} min={10} max={28} onChange={(v) => set('titleFontSizePx', v)} />
          <NumField id="bs" label="Body size (px)" value={s.fontSizePx} min={10} max={28} onChange={(v) => set('fontSizePx', v)} />
          <div>
            <label htmlFor="tw" style={label}>Title weight</label>
            <select id="tw" value={s.titleFontWeight} onChange={(e) => set('titleFontWeight', Number(e.target.value))} style={field}>
              {weights.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="bw" style={label}>Body weight</label>
            <select id="bw" value={s.fontWeight} onChange={(e) => set('fontWeight', Number(e.target.value))} style={field}>
              {weights.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ta" style={label}>Alignment</label>
            <select id="ta" value={s.textAlign} onChange={(e) => set('textAlign', e.target.value as BannerSettings['textAlign'])} style={field}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <NumField id="ls" label="Letter spacing (em)" value={s.letterSpacingEm} min={-0.05} max={0.5} step={0.01} onChange={(v) => set('letterSpacingEm', v)} />
          <NumField id="py" label="Vertical padding (px)" value={s.paddingYPx} min={0} max={40} onChange={(v) => set('paddingYPx', v)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Toggle checked={s.uppercase} onChange={(v) => set('uppercase', v)} title="Uppercase text" hint="Renders the banner copy in all caps." />
        </div>
      </div>

      {/* ── Save ── */}
      <div style={{ display: 'flex', minWidth: 0, gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: 'var(--s1)', padding: '14px 0', borderTop: '1px solid #eef0f7' }}>
        <button onClick={save} disabled={busy || !dirty} style={{ ...btn, opacity: busy || !dirty ? 0.5 : 1 }}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button onClick={() => setS(saved)} disabled={busy || !dirty} style={{ ...btnGhost, opacity: busy || !dirty ? 0.5 : 1 }}>
          Discard
        </button>
        <span style={{ fontSize: 12.5, color: dirty ? 'var(--orange-text)' : 'var(--t3)', fontWeight: 700 }}>
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label style={{ display: 'flex', minWidth: 0, gap: 10, alignItems: 'flex-start', padding: '9px 0', cursor: 'pointer' }}>
      {/* aria-label mirrors the visible {title}: the label wraps the input, but the
          text is nested/dynamic so it isn't statically detectable as the name. */}
      <input type="checkbox" aria-label={title} checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer' }} />
      <span>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--t1)' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{hint}</span>
      </span>
    </label>
  );
}

function ColorField({ id, label: text, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      <label htmlFor={id} style={label}>{text}</label>
      <div style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'center' }}>
        <input id={id} type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
          style={{ width: 44, minWidth: 44, height: 44, flexShrink: 0, padding: 2, border: '1px solid #d1d5db', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', background: 'var(--s1)' }} />
        <input type="text" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
          aria-label={`${text} hex value`} style={{ ...field, fontFamily: 'ui-monospace, monospace' }} />
      </div>
    </div>
  );
}

function NumField({ id, label: text, value, min, max, step = 1, onChange }: { id: string; label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} style={label}>{text}</label>
      <input id={id} type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        style={field} />
    </div>
  );
}
