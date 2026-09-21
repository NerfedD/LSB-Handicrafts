import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from } }));
import { loadAllRows, ordersCollection } from './storageManager';

function pagedTable(source, cap, onRead = () => {}) {
  let reads = 0;
  from.mockImplementation(() => {
    let start = 0;
    let limit = Infinity;
    let after = -Infinity;
    const query = {
      select: () => query,
      order: () => query,
      range: (a, b) => { start = a; limit = b - a + 1; return query; },
      limit: (n) => { limit = n; return query; },
      gt: (_, value) => { after = value; return query; },
      then: (resolve, reject) => {
        onRead(++reads, source);
        return Promise.resolve({ data: source.filter((row) => row.id > after).slice(start, start + Math.min(limit, cap)) }).then(resolve, reject);
      },
    };
    return query;
  });
}

beforeEach(() => vi.clearAllMocks());

describe('collection pagination', () => {
  it.each([100, 500, 1000])('reads past a server cap of %i rows', async (cap) => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ id: i + 1 }));
    pagedTable(rows, cap);
    expect(await loadAllRows('orders')).toEqual(rows);
  });

  it('does not skip records if an earlier page loses a row during the read', async () => {
    const rows = Array.from({ length: 503 }, (_, i) => ({ id: i + 1 }));
    pagedTable(rows, 500, (read, current) => { if (read === 2) current.shift(); });
    const result = await loadAllRows('orders');
    expect(result.map((row) => row.id)).toEqual(Array.from({ length: 503 }, (_, i) => i + 1));
  });

  it('rejects a failed later page instead of reporting a partial collection', async () => {
    pagedTable(Array.from({ length: 501 }, (_, i) => ({ id: i })), 500, (read) => {
      if (read === 2) throw new Error('connection lost');
    });
    await expect(loadAllRows('orders')).rejects.toThrow('connection lost');
  });

  it('matches the order revision before saving a price correction', async () => {
    const eq = vi.fn();
    const query = { update: () => query, eq: (...args) => { eq(...args); return query; }, select: () => query, maybeSingle: async () => ({ data: null }) };
    from.mockReturnValue(query);
    const result = await ordersCollection.update(1042, { id: 1042, revision: 4, totalAmount: 0 });
    expect(eq).toHaveBeenCalledWith('revision', 4);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/changed|refresh/i);
  });
});
