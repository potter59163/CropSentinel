import { describe, it, expect } from 'vitest';
import { farmInputSchema, sanitizeAssumptions, KNOWN_CROP_IDS } from './planSchema';
import { buildSystems } from './engine';
import type { FarmInput } from '../data/types';

const base = {
  currentCropId: 'ข้าวโพดเลี้ยงสัตว์',
  sizeRai: 10,
  elevationM: 420,
  locationLabel: 'ปัว',
  lat: 19.179,
  lng: 100.907,
  selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] },
  goal: 'balanced' as const,
};

describe('cropId must not reach a prototype-chain lookup', () => {
  // Verified live before the fix: POSTing cropId "constructor" to /api/plan returned
  // transitionCost, profit10, paybackYear and every cumulative cashflow value as null,
  // because TRANSITION_COST_PER_RAI["constructor"] resolved to Object and NaN spread
  // through the arithmetic — while the agronomic sections still looked authoritative.
  const dangerous = ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty'];

  it.each(dangerous)('coerces the prototype key %s to อื่นๆ at the schema boundary', (key) => {
    const parsed = farmInputSchema.parse({
      ...base,
      existingZones: [{ id: 'z1', cropId: key, areaRai: 10 }],
    });
    expect(parsed.existingZones![0].cropId).toBe('อื่นๆ');
    expect(KNOWN_CROP_IDS).toContain(parsed.existingZones![0].cropId);
  });

  it('coerces a dangerous currentCropId too', () => {
    expect(farmInputSchema.parse({ ...base, currentCropId: 'constructor' }).currentCropId).toBe('อื่นๆ');
  });

  it('keeps the cashflow finite even if a prototype key reaches the engine directly', () => {
    // Second line of defence: engine.transitionContext uses Object.hasOwn, so even a
    // caller that bypasses the schema cannot NaN-poison the numbers.
    const input = {
      ...base,
      existingZones: [{ id: 'z1', cropId: 'constructor', areaRai: 10 }],
    } as unknown as FarmInput;
    const [sys] = buildSystems(input, null, null, null);
    expect(Number.isFinite(sys.transitionCost)).toBe(true);
    expect(Number.isFinite(sys.profit10)).toBe(true);
    sys.cashflow.forEach((c) => expect(Number.isFinite(c.cumulative)).toBe(true));
  });
});

describe('sanitizeAssumptions — an override may only touch a plant the user selected', () => {
  // The override editor renders rows only for selectedByLayer, so an assumption on any
  // other plant is invisible in the UI, yet engine.applyAssumption applies it and still
  // stamps the pick pickedBy:'system'. A crafted ?plan= link exploited exactly that:
  // production profit10 went from 5.7M to 34.1M with attacker prices shown as the
  // model's own recommendation.
  it('drops assumptions for unselected plants', () => {
    const out = sanitizeAssumptions({
      selectedByLayer: { canopy: ['mango'], shrub: [], groundcover: [], root: [] },
      cropAssumptions: [
        { plantId: 'mango', pricePerKg: 45 },
        { plantId: 'teak', pricePerKg: 400 },
      ],
    });
    expect(out.cropAssumptions).toEqual([{ plantId: 'mango', pricePerKg: 45 }]);
  });

  it('drops every assumption when nothing is selected', () => {
    const out = sanitizeAssumptions({
      selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] },
      cropAssumptions: [{ plantId: 'mango', pricePerKg: 300 }],
    });
    expect(out.cropAssumptions).toEqual([]);
  });

  it('is a no-op when every assumption is legitimately selected', () => {
    const input = {
      selectedByLayer: { canopy: ['mango'], shrub: [], groundcover: [], root: [] },
      cropAssumptions: [{ plantId: 'mango', pricePerKg: 45 }],
    };
    expect(sanitizeAssumptions(input)).toBe(input);
  });

  it('neutralises the measured share-link injection end to end', () => {
    // The exploit's bite came from overriding plants the SYSTEM picks, so the attacker's
    // prices are presented as the model's own recommendation. Target whatever the system
    // actually chooses for this plot rather than naming species: the catalogue has grown
    // from 21 to 52 and hard-coding mango/teak silently made this assertion vacuous once
    // neither was auto-picked any more.
    const baseline = buildSystems(farmInputSchema.parse(base) as unknown as FarmInput, null, null, null)[0];
    const pickedIds = baseline.picks.map((p) => p.plant.id);
    expect(pickedIds.length).toBeGreaterThan(0);

    const hostile = farmInputSchema.parse({
      ...base,
      cropAssumptions: pickedIds.map((plantId) => ({
        plantId, pricePerKg: 5000, yieldKgPerRai: 9000, establishCostPerRai: 0, annualCostPerRai: 0,
      })),
    });
    const clean = sanitizeAssumptions(hostile);
    // The victim selected nothing, so every injected override must be stripped.
    expect(clean.cropAssumptions).toEqual([]);

    const dirtyPlan = buildSystems(hostile as unknown as FarmInput, null, null, null)[0];
    const cleanPlan = buildSystems(clean as unknown as FarmInput, null, null, null)[0];
    expect(cleanPlan.profit10).toBeLessThan(dirtyPlan.profit10);
  });
});
