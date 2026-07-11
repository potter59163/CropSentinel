import { describe, it, expect } from 'vitest';
import { plantSuitability, modelMeta } from './suitability';
import { plantById } from '../data/plants';
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
