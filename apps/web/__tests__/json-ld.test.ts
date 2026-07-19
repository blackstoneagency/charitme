import { describe, expect, it } from 'vitest';
import { safeJsonLd } from '../lib/json-ld';

describe('safeJsonLd', () => {
  it('escapes < > & so a </script> breakout is impossible', () => {
    const out = safeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).toContain('\\u003c');
    expect(out).toContain('\\u003e');
  });

  it('escapes ampersands', () => {
    expect(safeJsonLd({ x: 'a & b' })).toContain('\\u0026');
  });

  it('escapes U+2028 / U+2029 line separators', () => {
    const sep = 'a' + String.fromCharCode(0x2028) + 'b' + String.fromCharCode(0x2029) + 'c';
    const out = safeJsonLd({ x: sep });
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
  });

  it('remains valid JSON that round-trips to the original value', () => {
    const value = { title: '</script> "quoted" & <b>bold</b>', n: 42 };
    expect(JSON.parse(safeJsonLd(value))).toEqual(value);
  });
});
