import { describe, expect, it } from 'vitest';
import { decodeKeysetCursor, encodeKeysetCursor } from '../lib/keyset-cursor';

describe('keyset cursors', () => {
  it('round trips a timestamp and UUID', () => {
    const input = {
      createdAt: '2026-08-10T12:30:45.000Z',
      id: '11111111-1111-4111-8111-111111111111',
    };
    expect(decodeKeysetCursor(encodeKeysetCursor(input))).toEqual(input);
  });

  it('rejects malformed, noncanonical, and oversized values', () => {
    expect(decodeKeysetCursor('not-base64!')).toBeNull();
    expect(decodeKeysetCursor(Buffer.from('2026-08-10|not-a-uuid').toString('base64url'))).toBeNull();
    expect(decodeKeysetCursor('x'.repeat(257))).toBeNull();
  });
});
