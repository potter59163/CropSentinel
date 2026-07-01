import { describe, it, expect } from 'vitest';
import { buildSystems } from './engine';
import { plantSuitability } from './suitability';
import { PLANTS } from '../data/plants';
import type { Climate } from './climate';
import type { SoilContext } from './soil';
import type { FarmInput } from '../data/types';

const plant = (id: string) => {
  const p = PLANTS.find((x) => x.id === id);
  if (!p) throw new Error(`no plant ${id}`);
  return p;
};

const baseInput = (over: Partial<FarmInput> = {}): FarmInput => ({
  currentCropId: null, sizeRai: 10, elevationM: 420, locationLabel: 'test',
  lat: 19.1, lng: 100.9,
  selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] },
  goal: 'balanced', ...over,
});

const climate = (elev: number): Climate => ({
  t2m: 25, prec: 1200, drym: 4, pseas: 60, trange: 12, solar: 18, rh: 72, gwet: 0.55, elev,
});

describe('buildSystems', () => {
  it('returns up to 3 systems with finite, bounded metrics', () => {
    const systems = buildSystems(baseInput(), null, null, null);
    expect(systems.length).toBeGreaterThan(0);
    expect(systems.length).toBeLessThanOrEqual(3);

    for (const s of systems) {
      expect(Number.isFinite(s.profit10)).toBe(true);
      expect(s.picks.length).toBeGreaterThan(0);
      expect(s.canopy.length).toBeGreaterThanOrEqual(2); // canopy is forced to >= 2
      expect(s.cashflow).toHaveLength(10);
      expect(s.sensitivity).toHaveLength(3);
      expect(s.carbon10).toBeGreaterThanOrEqual(0);
      expect(s.scoreParts.agroforestry).toBeGreaterThanOrEqual(0);
      expect(s.scoreParts.agroforestry).toBeLessThanOrEqual(1);
      expect(s.soilHealth.score).toBeGreaterThanOrEqual(0);
      expect(s.soilHealth.score).toBeLessThanOrEqual(1);
      if (s.paybackYear !== null) {
        expect(s.paybackYear).toBeGreaterThanOrEqual(1);
        expect(s.paybackYear).toBeLessThanOrEqual(10);
      }
    }
  });

  it('forces a farmer-selected plant into the plan', () => {
    const input = baseInput({ selectedByLayer: { canopy: ['mango'], shrub: [], groundcover: [], root: [] } });
    const [best] = buildSystems(input, null, null, null);
    const mango = best.picks.find((p) => p.plant.id === 'mango');
    expect(mango).toBeDefined();
    expect(mango?.pickedBy).toBe('farmer');
  });

  it('price sensitivity is monotonic: -30% <= base <= +30%', () => {
    const [s] = buildSystems(baseInput(), null, null, null);
    const by = Object.fromEntries(s.sensitivity.map((x) => [x.id, x.profit10]));
    expect(by.down30).toBeLessThanOrEqual(by.base);
    expect(by.base).toBeLessThanOrEqual(by.up30);
  });

  it('uses existing land-use zones as first-year transition cost', () => {
    const [withoutZones] = buildSystems(baseInput(), null, null, null);
    const [withZones] = buildSystems(baseInput({
      existingZones: [{ id: 'z1', cropId: 'ยางพารา', areaRai: 10 }],
    }), null, null, null);

    expect(withZones.transitionCost).toBeGreaterThan(0);
    expect(withZones.cashflow[0].cost).toBe(withZones.transitionCost);
    expect(withZones.cashflow[0].net).toBeLessThan(withoutZones.cashflow[0].net);
    expect(withZones.profit10).toBeLessThan(withoutZones.profit10);
  });
});

describe('plantSuitability — agronomic guardrails', () => {
  it('ranks a highland crop higher at altitude than in the lowland', () => {
    const mac = plant('macadamia'); // elevMin 800
    const low = plantSuitability(mac, climate(400), null, null).score;
    const high = plantSuitability(mac, climate(1100), null, null).score;
    expect(high).toBeGreaterThan(low);
  });

  it('caps a far-out-of-range crop to a low score', () => {
    const coffee = plant('coffee'); // elevMin 800
    const s = plantSuitability(coffee, climate(350), null, null).score;
    expect(s).toBeLessThan(0.6);
  });

  it('falls back to the elevation envelope when no climate is available', () => {
    const s = plantSuitability(plant('mango'), null, null, null);
    expect(s.source).toBe('envelope');
    expect(s.score).toBeGreaterThan(0);
    expect(s.score).toBeLessThanOrEqual(1);
  });

  it('stays in [0,1] when a real soil context is supplied', () => {
    const soil = {
      ph: 5.0, organicCarbonPct: 1, nitrogenPct: 0.1, clayPct: 45, sandPct: 25, siltPct: 30, cec: 120,
      texture: '', textureEn: '', drainage: 'poor', drainageTh: '', acidity: 'strong', acidityTh: '',
      fertility: 0.4, fertilityTh: '', depthLabel: '', source: '', sdmFeatureSource: 'soilgrids',
    } as SoilContext;
    const s = plantSuitability(plant('cashew'), climate(400), null, soil).score;
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
