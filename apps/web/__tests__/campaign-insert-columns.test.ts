import { describe, expect, it } from 'vitest';
import {
  OPTIONAL_CAMPAIGN_COLUMNS,
  insertTolerantOfMissingColumns,
  missingOptionalColumn,
  withoutColumn,
} from '../lib/campaign-insert-columns';

const schemaCacheMiss = (column: string) => ({
  code: 'PGRST204',
  message: `Could not find the '${column}' column of 'campaigns' in the schema cache`,
});

const undefinedColumn = (column: string) => ({
  code: '42703',
  message: `column "${column}" of relation "campaigns" does not exist`,
});

describe('missingOptionalColumn', () => {
  it('recognises both error codes that mean "this column is not there"', () => {
    expect(missingOptionalColumn(schemaCacheMiss('image_urls'))).toBe('image_urls');
    expect(missingOptionalColumn(undefinedColumn('campaign_path'))).toBe('campaign_path');
  });

  it('returns null when there is no error', () => {
    expect(missingOptionalColumn(null)).toBeNull();
    expect(missingOptionalColumn(undefined)).toBeNull();
  });

  it('does NOT retry on a real failure', () => {
    // This is the important one. Treating a constraint violation or an RLS
    // refusal as a missing column would silently drop the data and insert
    // anyway, turning a loud failure into a quiet wrong result.
    expect(missingOptionalColumn({ code: '23505', message: 'duplicate key value' })).toBeNull();
    expect(missingOptionalColumn({ code: '42501', message: 'permission denied' })).toBeNull();
    expect(missingOptionalColumn({ code: '23514', message: 'violates check constraint' })).toBeNull();
  });

  it('ignores a matching code that names no optional column', () => {
    expect(missingOptionalColumn(undefinedColumn('some_other_column'))).toBeNull();
  });

  it('is not fooled by a column name that contains another', () => {
    // Longest-first matching: 'campaign_path' must not resolve to a shorter
    // column that happens to be a substring of the message.
    const columns = ['path', 'campaign_path'];
    expect(missingOptionalColumn(undefinedColumn('campaign_path'), columns)).toBe('campaign_path');
  });

  it('tolerates an error with no message', () => {
    expect(missingOptionalColumn({ code: 'PGRST204' })).toBeNull();
  });
});

describe('withoutColumn', () => {
  it('removes the column without mutating the original', () => {
    const payload = { title: 'A', image_urls: [], campaign_path: 'personal' };
    const stripped = withoutColumn(payload, 'image_urls');
    expect('image_urls' in stripped).toBe(false);
    expect('image_urls' in payload).toBe(true);
    expect(stripped.title).toBe('A');
  });
});

describe('insertTolerantOfMissingColumns', () => {
  it('inserts ONCE when every column exists', () => {
    // The normal case in any migrated environment. A retry here would double
    // the write path's cost for no reason.
    const calls: Record<string, unknown>[] = [];
    return insertTolerantOfMissingColumns(
      { title: 'A', image_urls: [], campaign_path: 'team' },
      async (payload) => { calls.push(payload); return { error: null, data: { id: '1' } }; },
    ).then(({ dropped }) => {
      expect(calls).toHaveLength(1);
      expect(dropped).toEqual([]);
      expect(calls[0]).toHaveProperty('campaign_path', 'team');
    });
  });

  it('drops one missing column and retries', async () => {
    const calls: Record<string, unknown>[] = [];
    const { dropped, result } = await insertTolerantOfMissingColumns(
      { title: 'A', image_urls: [], campaign_path: 'nonprofit' },
      async (payload) => {
        calls.push(payload);
        if ('campaign_path' in payload) return { error: undefinedColumn('campaign_path') };
        return { error: null };
      },
    );
    expect(calls).toHaveLength(2);
    expect(dropped).toEqual(['campaign_path']);
    expect(result.error).toBeNull();
    expect(calls[1]).not.toHaveProperty('campaign_path');
    // The campaign is still created — just without the new field.
    expect(calls[1]).toHaveProperty('title', 'A');
  });

  it('drops BOTH columns when neither exists, in any order', async () => {
    // The case the old hand-rolled single-column fallback could not handle:
    // an unmigrated database missing image_urls AND campaign_path.
    const calls: Record<string, unknown>[] = [];
    const { dropped, result } = await insertTolerantOfMissingColumns(
      { title: 'A', image_urls: [], campaign_path: 'personal' },
      async (payload) => {
        calls.push(payload);
        if ('image_urls' in payload) return { error: schemaCacheMiss('image_urls') };
        if ('campaign_path' in payload) return { error: undefinedColumn('campaign_path') };
        return { error: null };
      },
    );
    expect(calls).toHaveLength(3);
    expect(dropped.sort()).toEqual(['campaign_path', 'image_urls']);
    expect(result.error).toBeNull();
  });

  it('gives up on a real error instead of stripping the payload', async () => {
    let attempts = 0;
    const { dropped, result } = await insertTolerantOfMissingColumns(
      { title: 'A', image_urls: [], campaign_path: 'personal' },
      async () => { attempts++; return { error: { code: '23505', message: 'duplicate key value' } }; },
    );
    expect(attempts).toBe(1);
    expect(dropped).toEqual([]);
    expect(result.error?.code).toBe('23505');
  });

  it('cannot loop when the database keeps naming an already-dropped column', async () => {
    // Defensive: a confused schema cache repeating a stale name must terminate.
    let attempts = 0;
    await insertTolerantOfMissingColumns(
      { title: 'A', image_urls: [] },
      async () => { attempts++; return { error: schemaCacheMiss('image_urls') }; },
    );
    expect(attempts).toBeLessThanOrEqual(OPTIONAL_CAMPAIGN_COLUMNS.length + 1);
  });

  it('is bounded by the number of optional columns', async () => {
    let attempts = 0;
    await insertTolerantOfMissingColumns(
      { a: 1, b: 2 },
      async () => { attempts++; return { error: undefinedColumn(attempts === 1 ? 'a' : 'b') }; },
      ['a', 'b'],
    );
    expect(attempts).toBeLessThanOrEqual(3);
  });
});
