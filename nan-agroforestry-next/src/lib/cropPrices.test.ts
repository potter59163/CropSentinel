import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The admin price layer, which silently outranks every researched figure in plants.ts — a
 * production audit found 18 species overridden, one of them 167% above the default, and nothing
 * anywhere said so. It has never had a test.
 *
 * The DB is mocked at the tagged-template level rather than reached over the network: what needs
 * pinning is the ORDER of statements and the fallback behaviour, not Postgres.
 */

type Call = { text: string; values: unknown[] };
const calls: Call[] = [];
let nextRows: unknown[] = [];
let failNext = false;

// Records the SQL a call would send. Neon's driver is invoked as a tagged template, so the
// strings arrive split around the interpolated values.
const fakeSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
  if (failNext) return Promise.reject(new Error('connection lost'));
  calls.push({ text: strings.join('?').replace(/\s+/g, ' ').trim(), values });
  return Promise.resolve(nextRows);
};

vi.mock('./db', () => ({
  sql: () => fakeSql,
  dbConfigured: () => process.env.DATABASE_URL != null,
}));

const { getCropPriceOverrides, setCropPriceOverride, clearCropPriceOverride } = await import('./cropPrices');

beforeEach(() => {
  calls.length = 0;
  nextRows = [];
  failNext = false;
  process.env.DATABASE_URL = 'postgres://test';
});

afterEach(() => {
  delete process.env.DATABASE_URL;
});

describe('getCropPriceOverrides', () => {
  it('reads only admin price rows, so an unreviewed import cannot reach live plans', async () => {
    await getCropPriceOverrides();
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain("source = 'admin_price_update'");
    expect(calls[0].text).toContain('price_per_kg IS NOT NULL');
  });

  it('returns the numeric price, not the string Postgres sends for numeric columns', async () => {
    nextRows = [{ plant_id: 'ginger', price_per_kg: '42.50', updated_at: '2026-06-15T00:00:00Z' }];
    const out = await getCropPriceOverrides();
    expect(out.ginger.pricePerKg).toBe(42.5);
    expect(typeof out.ginger.pricePerKg).toBe('number');
  });

  it('falls back to the researched defaults when the DB is unreachable', async () => {
    // A price layer outage must not take plan requests down with it — the code in plants.ts is
    // the more defensible number anyway.
    failNext = true;
    await expect(getCropPriceOverrides()).resolves.toEqual({});
  });

  it('does nothing at all when no database is configured', async () => {
    delete process.env.DATABASE_URL;
    await expect(getCropPriceOverrides()).resolves.toEqual({});
    expect(calls).toHaveLength(0);
  });
});

describe('setCropPriceOverride', () => {
  it('replaces the previous override instead of appending beside it', async () => {
    // The bug this pins: rows were appended and the read picked the largest updated_at, so
    // back-dating a correction to an older OAE bulletin lost to the override already in place.
    // The admin saw "บันทึกแล้ว" and the stale price stayed live.
    await setCropPriceOverride('ginger', 42.5, '2026-06-15');
    expect(calls).toHaveLength(2);
    expect(calls[0].text).toContain('DELETE FROM crop_assumptions');
    expect(calls[1].text).toContain('INSERT INTO crop_assumptions');
    expect(calls[0].values).toContain('ginger');
  });

  it('stores the date of the SOURCE, not the moment of the edit', async () => {
    await setCropPriceOverride('ginger', 42.5, '2026-06-15');
    expect(calls[1].values).toContain('2026-06-15');
  });

  it('stamps today when no source date is given', async () => {
    await setCropPriceOverride('ginger', 42.5);
    const stamped = calls[1].values.find((v) => typeof v === 'string' && v.includes('T'));
    expect(stamped).toBeTruthy();
  });
});

describe('clearCropPriceOverride', () => {
  it('deletes rather than writing back the current default', async () => {
    // Writing the default as a row would shadow any later correction to plants.ts with a stale
    // copy of the old one — the exact class of invisible override this layer exists to expose.
    await clearCropPriceOverride('ginger');
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain('DELETE FROM crop_assumptions');
    expect(calls[0].text).toContain("source = 'admin_price_update'");
  });
});
