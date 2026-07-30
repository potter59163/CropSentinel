import { describe, it, expect } from 'vitest';
import { plantSuitability, modelMeta } from './suitability';
import { plantById, PLANTS } from '../data/plants';
import type { Climate } from './climate';

// A plausible lowland-Nan climate near the training medians. These golden values
// lock in the *deployed JS inference* (feature vector assembly, standardization
// for the logit head, GBM tree traversal, and the log-odds `init` term). If the
// training export ever regresses — e.g. exports the class-prior probability
// instead of its logit as `gbm.init` — the GBM scores shift and these break.
const NAN_LOWLAND: Climate = {
  t2m: 26, prec: 1450, drym: 3, pseas: 62, trange: 22, solar: 18, rh: 79, gwet: 0.65, elev: 300,
};

describe('SDM inference (deployed JS runtime)', () => {
  it('produces the expected bounded probability for a model-backed species with real climate', () => {
    const s = plantSuitability(plantById('banana'), NAN_LOWLAND);
    expect(s.source).toBe('model');
    expect(s.score).toBeGreaterThan(0);
    expect(s.score).toBeLessThanOrEqual(1);
    // Golden band around the known deployed value (~0.256). The init-as-probability
    // export bug would inflate GBM scores well past this, so a tight band catches it.
    expect(s.score).toBeGreaterThan(0.2);
    expect(s.score).toBeLessThan(0.32);
  });

  it('falls back to the honest elevation envelope when climate is missing (no median-imputed model score)', () => {
    const s = plantSuitability(plantById('banana'), null);
    expect(s.source).toBe('envelope');
    expect(s.confidence).not.toBe('high');
  });

  it('treats a NaN-feature (elevation-only) climate as no-model, but still uses the REAL elevation', () => {
    // planRunner returns this shape on a NASA POWER outage: real elev, NaN weather.
    const elevOnly = { t2m: NaN, prec: NaN, drym: NaN, pseas: NaN, trange: NaN, solar: NaN, rh: NaN, gwet: NaN, elev: 1400 };
    const macadamia = plantSuitability(plantById('macadamia'), elevOnly); // elevMin 800 — 1400 is in range
    const cashew = plantSuitability(plantById('cashew'), elevOnly);       // elevMax 700 — 1400 is far above
    expect(macadamia.source).toBe('envelope'); // NaN features must NOT run the SDM on medians
    // elevation still discriminates: highland-suited crop beats a lowland one at 1400 m
    expect(macadamia.score).toBeGreaterThan(cashew.score);
  });

  it('ranks a highland species below a lowland one at low elevation', () => {
    const banana = plantSuitability(plantById('banana'), NAN_LOWLAND).score; // elevMin 0
    const macadamia = plantSuitability(plantById('macadamia'), NAN_LOWLAND).score; // elevMin 800
    expect(banana).toBeGreaterThan(macadamia);
  });

  it('is deterministic (same inputs → identical score)', () => {
    const a = plantSuitability(plantById('mango'), NAN_LOWLAND).score;
    const b = plantSuitability(plantById('mango'), NAN_LOWLAND).score;
    expect(a).toBe(b);
  });

  it('exposes a production-ready model (enough species above the AUC floor)', () => {
    const meta = modelMeta();
    expect(meta.count).toBeGreaterThanOrEqual(15);
    expect(meta.avgAuc).toBeGreaterThan(0.65);
  });
});

// ── offline honesty ─────────────────────────────────────────────────────────
// A climate outage must never make a plan look BETTER than the same plot computed
// with live data. envelope() returns exactly 1.0 for any in-range elevation, and
// suitability feeds revenue directly (engine.plantFlow), so an uncapped fallback
// inflated offline profit10 by 50-95% and painted every species reassuringly green.
describe('envelope fallback must not outscore the trained model', () => {
  const offline = (elev: number): Climate => ({
    t2m: NaN, prec: NaN, drym: NaN, pseas: NaN, trange: NaN,
    solar: NaN, rh: NaN, gwet: NaN, elev,
  });

  it('caps a perfectly in-range offline score below a confident model score', () => {
    // banana range is 0–1200 m, so 300 m is comfortably in range → envelope() = 1.0
    const s = plantSuitability(plantById('banana'), offline(300));
    expect(s.source).toBe('envelope');
    expect(s.score).toBeLessThan(1);
    expect(s.score).toBeLessThanOrEqual(0.72);
  });

  it('still penalises an out-of-range elevation rather than flattening everything', () => {
    // coffee wants 800–1600 m; at 150 m it must score well below an in-range plant
    const low = plantSuitability(plantById('coffee'), offline(150));
    const good = plantSuitability(plantById('coffee'), offline(1200));
    expect(low.score).toBeLessThan(good.score);
  });

  it('uses the PLOT elevation, not the species own elevMin, when weather is missing', () => {
    // The old `c?.elev ?? plant.elevMin` default scored every species at its personal
    // optimum, which is why 30 sample plots from 180 m to 1,350 m returned one identical
    // plan. Two different plot elevations must give macadamia (800–1600 m) different scores.
    const atSeaLevel = plantSuitability(plantById('macadamia'), offline(50));
    const atRange = plantSuitability(plantById('macadamia'), offline(1000));
    expect(atSeaLevel.score).not.toBeCloseTo(atRange.score, 3);
    expect(atSeaLevel.score).toBeLessThan(atRange.score);
  });

  it('labels a species with no trained model as expert judgement, not a weak model', () => {
    // ชาเมี่ยง carries sdmId 'tea' but has no entry in sdm_model.json, so it must not
    // be able to present a perfect 1.0 as if it were a modelled result.
    const s = plantSuitability(plantById('tea'), offline(1000));
    expect(s.source).toBe('envelope');
    expect(s.confidence).toBe('expert');
    expect(s.score).toBeLessThanOrEqual(0.72);
  });
});

// ── train/serve skew on the disaster features ───────────────────────────────
// The shipped model has weights for five GISTDA disaster columns that are near-constant in
// its training pool (flood7d_near is 0 in all 4,245 cells) while the runtime fed them real
// values. Because logitPredict standardizes by (x - mean) / std and those stds are tiny,
// a live fire7d_near of log1p(9) landed ~24 SD out and pinned the sigmoid at 1.0. Measured
// before the fix: suitability moved by mean 0.347 / max 0.777 at one 1,200 m Nan plot, with
// taro 0.223 -> 1.000 — an ~87% swing in projected revenue driven by data coverage.
describe('live GISTDA risk must not reach the SDM feature vector', () => {
  const climate: Climate = {
    t2m: 23.1, prec: 1076, drym: 5, pseas: 62, trange: 22, solar: 18, rh: 79, gwet: 0.65, elev: 1200,
  };
  // Deliberately extreme but realistic for Nan in fire season.
  const liveRisk = {
    disasterFire7dNear: 9,
    disasterBurnFreqNear: 4,
    disasterFlood7dNear: 0,
    disasterFloodFreqNear: 12,
    disasterDroughtLayers: ['a', 'b', 'c'],
    fireNearby: 9,
  } as unknown as Parameters<typeof plantSuitability>[2];

  it('gives byte-identical suitability with and without live risk, for every crop', () => {
    for (const p of PLANTS) {
      const off = plantSuitability(p, climate, null, null).score;
      const on = plantSuitability(p, climate, liveRisk, null).score;
      expect(on, `${p.id} shifted when live GISTDA risk was supplied`).toBeCloseTo(off, 10);
    }
  });

  it('never saturates a crop at a perfect score because of risk data', () => {
    // taro and galangal were the two that hit exactly 1.000 before the fix.
    for (const id of ['taro', 'galangal', 'turmeric']) {
      const s = plantSuitability(plantById(id), climate, liveRisk, null).score;
      expect(s, `${id} saturated`).toBeLessThan(1);
    }
  });
});
