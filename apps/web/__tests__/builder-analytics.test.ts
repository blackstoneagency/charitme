import { describe, it, expect } from 'vitest';
import { parseBuilderEvent } from '../lib/builder-analytics';

const ok = { sessionId: 'sess-1', path: 'guided', step: 'story', event: 'enter', meta: { a: 1 } };

describe('parseBuilderEvent', () => {
  it('accepts a valid payload and normalizes it', () => {
    const r = parseBuilderEvent(ok);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ session_id: 'sess-1', path: 'guided', step: 'story', event: 'enter', meta: { a: 1 } });
  });

  it('rejects unknown events', () => {
    expect(parseBuilderEvent({ ...ok, event: 'hack' }).ok).toBe(false);
  });

  it('defaults an unknown path to guided', () => {
    const r = parseBuilderEvent({ ...ok, path: 'nope' });
    expect(r.ok && r.value.path).toBe('guided');
  });

  it('requires a session id and a step', () => {
    expect(parseBuilderEvent({ ...ok, sessionId: '' }).ok).toBe(false);
    expect(parseBuilderEvent({ ...ok, step: '  ' }).ok).toBe(false);
  });

  it('rejects an over-long session id', () => {
    expect(parseBuilderEvent({ ...ok, sessionId: 'x'.repeat(101) }).ok).toBe(false);
  });

  it('truncates a long step to 60 chars', () => {
    const r = parseBuilderEvent({ ...ok, step: 'y'.repeat(200) });
    expect(r.ok && r.value.step.length).toBe(60);
  });

  it('drops oversized meta but keeps the event', () => {
    const big = { blob: 'z'.repeat(5000) };
    const r = parseBuilderEvent({ ...ok, meta: big });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.meta).toEqual({});
  });

  it('rejects non-object bodies', () => {
    expect(parseBuilderEvent(null).ok).toBe(false);
    expect(parseBuilderEvent('str').ok).toBe(false);
  });
});
