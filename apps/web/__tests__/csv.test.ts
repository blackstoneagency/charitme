import { describe, expect, it } from 'vitest';
import { escapeCsvCell, toCsv, rowsToCsv } from '../lib/csv';

describe('escapeCsvCell — formula injection', () => {
  it('neutralizes leading = + @ formula triggers', () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(escapeCsvCell('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)");
    expect(escapeCsvCell('+1+2')).toBe("'+1+2");
  });

  it('neutralizes a formula that starts with a minus but is not a number', () => {
    expect(escapeCsvCell('-1+cmd|calc')).toBe("'-1+cmd|calc");
  });

  it('leaves genuine numbers (including negatives) untouched', () => {
    expect(escapeCsvCell('-5')).toBe('-5');
    expect(escapeCsvCell('-12.50')).toBe('-12.50');
    expect(escapeCsvCell(42)).toBe('42');
  });

  it('applies structural quoting for commas/quotes/newlines', () => {
    expect(escapeCsvCell('Smith, Jane')).toBe('"Smith, Jane"');
    expect(escapeCsvCell('a "quoted" b')).toBe('"a ""quoted"" b"');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('renders null/undefined as empty', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });
});

describe('toCsv / rowsToCsv', () => {
  it('builds a record CSV with a header row', () => {
    const csv = toCsv([{ name: 'Jane', amount: '10.00' }], ['name', 'amount']);
    expect(csv).toBe('name,amount\nJane,10.00');
  });

  it('escapes injected values inside a record CSV', () => {
    const csv = toCsv([{ name: '=danger', amount: '10.00' }], ['name', 'amount']);
    expect(csv.split('\n')[1]).toBe("'=danger,10.00");
  });

  it('builds an array CSV', () => {
    expect(rowsToCsv(['a', 'b'], [[1, 2], [3, 4]])).toBe('a,b\n1,2\n3,4');
  });
});
