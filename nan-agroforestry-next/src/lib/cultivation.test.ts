import { describe, it, expect } from 'vitest';
import { cultivationNear, CULTIVATION_RADIUS_KM } from './cultivation';

// Real Nan coordinates used elsewhere in the suite.
const PUA = { lat: 19.179, lng: 100.907 };
const BO_KLUEA = { lat: 19.094, lng: 101.165 };
// Far offshore in the Andaman — inside the app's Thailand bbox but no cultivation nearby.
const OFFSHORE = { lat: 8.0, lng: 97.6 };

describe('cultivationNear — a count of what is grown nearby, never a suitability score', () => {
  it('finds real cultivation around a Nan district town', () => {
    const c = cultivationNear(PUA.lat, PUA.lng);
    expect(c.unavailable).toBeUndefined();
    expect(Object.keys(c.byPlant).length).toBeGreaterThan(0);
    // Longan is the dominant Nan perennial, so it must be present near Pua.
    expect(c.byPlant.longan).toBeDefined();
    expect(c.byPlant.longan.tambons).toBeGreaterThan(0);
    expect(c.byPlant.longan.rai).toBeGreaterThan(0);
  });

  it('reports the distance to the nearest reporting tambon', () => {
    const c = cultivationNear(PUA.lat, PUA.lng);
    const longan = c.byPlant.longan;
    expect(longan.nearestKm).toBeGreaterThanOrEqual(0);
    expect(longan.nearestKm).toBeLessThanOrEqual(CULTIVATION_RADIUS_KM);
  });

  it('respects the radius — a smaller one cannot return more', () => {
    const wide = cultivationNear(PUA.lat, PUA.lng, 50);
    const tight = cultivationNear(PUA.lat, PUA.lng, 10);
    for (const [id, t] of Object.entries(tight.byPlant)) {
      expect(t.tambons).toBeLessThanOrEqual(wide.byPlant[id].tambons);
      expect(t.rai).toBeLessThanOrEqual(wide.byPlant[id].rai);
    }
    expect(Object.keys(tight.byPlant).length).toBeLessThanOrEqual(Object.keys(wide.byPlant).length);
  });

  it('omits a crop entirely rather than reporting zero, so the UI can say "not found" honestly', () => {
    const c = cultivationNear(PUA.lat, PUA.lng);
    for (const v of Object.values(c.byPlant)) {
      expect(v.tambons).toBeGreaterThan(0);
    }
  });

  it('returns nothing for a location with no cultivation in range', () => {
    const c = cultivationNear(OFFSHORE.lat, OFFSHORE.lng, 20);
    expect(c.unavailable).toBeUndefined(); // the dataset loaded fine; there is simply nothing near
    expect(Object.keys(c.byPlant)).toEqual([]);
  });

  // Absence must be distinguishable from a broken lookup, because rendering a failed lookup
  // as "nobody grows this nearby" would assert something false to a farmer.
  it('flags unavailable — not empty — for invalid coordinates', () => {
    for (const [lat, lng] of [[NaN, 100], [19, NaN], [Infinity, 100]]) {
      const c = cultivationNear(lat, lng);
      expect(c.unavailable).toBe(true);
      expect(Object.keys(c.byPlant)).toEqual([]);
    }
  });

  it('carries the radius and an attributable source', () => {
    const c = cultivationNear(BO_KLUEA.lat, BO_KLUEA.lng, 30);
    expect(c.radiusKm).toBe(30);
    expect(c.source).toMatch(/DOAE/);
    expect(c.source).toMatch(/HDX|OCHA|กรมแผนที่ทหาร/);
  });

  it('gives highland Bo Kluea a different picture from lowland Pua', () => {
    // Not asserting a direction, only that the signal is location-specific rather than a
    // constant — a lookup that returned the same thing everywhere would be useless.
    const pua = cultivationNear(PUA.lat, PUA.lng);
    const bo = cultivationNear(BO_KLUEA.lat, BO_KLUEA.lng);
    const keyOf = (c: typeof pua) => Object.entries(c.byPlant)
      .map(([k, v]) => `${k}:${v.tambons}`).sort().join(',');
    expect(keyOf(pua)).not.toBe(keyOf(bo));
  });
});
