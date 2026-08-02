import { describe, it, expect } from 'vitest';
import { buildSystems, plantableRai, LAYER_SHARE, MIXTURE_YIELD_FACTOR } from './engine';
import type { Climate } from './climate';
import type { FarmInput } from '../data/types';

/**
 * Guards on the numbers the whole tool is judged by.
 *
 * Every other test here checks that the engine does what it says. None of them checked WHAT IT
 * SAYS, so the entire calibration pass — dropping the land equivalent ratio from 1.6 to 1.25,
 * adding the mixture penalty, correcting chilli and pineapple — could be reverted by editing two
 * constants and the suite would stay green. That calibration is the answer to "why should a
 * farmer believe this", so it needs to be as hard to undo by accident as the code around it.
 *
 * These are deliberately not golden numbers. A golden profit10 breaks on every legitimate data
 * correction and gets updated without thought, which teaches the opposite lesson. They are the
 * claims the methodology makes, expressed as bounds.
 */

const climate = (elev: number): Climate => ({
  t2m: 25, prec: 1200, drym: 4, pseas: 60, trange: 12, solar: 18, rh: 72, gwet: 0.55, elev,
});

const input = (elev: number, goal: FarmInput['goal'], sizeRai = 10): FarmInput => ({
  currentCropId: null, sizeRai, elevationM: elev, locationLabel: 'test', lat: 19.1, lng: 100.9,
  selectedByLayer: { canopy: [], shrub: [], groundcover: [], root: [] }, goal,
});

/** Elevations spanning the province floor to เฉลิมพระเกียรติ. */
const ELEVATIONS = [250, 400, 600, 800, 950, 1200];
const GOALS: FarmInput['goal'][] = ['balanced', 'fast', 'profit'];

const everyPlan = (sizeRai = 10) =>
  ELEVATIONS.flatMap((e) => GOALS.flatMap((g) => buildSystems(input(e, g, sizeRai), climate(e), null, null)));

/**
 * กรมป่าไม้ 2558 measured net returns on real Thai agroforestry plots at 64–7,665 THB/rai/yr.
 * That is the only measured ceiling available, so the model is allowed to sit above the top of
 * it — a designed multi-strata plan should beat the average measured plot — but not by an amount
 * that stops being a projection and becomes a claim. See docs/METHODOLOGY.md §16 and §17.
 */
const HIGHEST_MEASURED_THB_PER_RAI_YEAR = 7_665;
// Was 4 while the cost data was uniformly too low. After putting the crop costs on OAE's full
// economic basis, correcting the root crops against DOAE cost studies, and deducting the
// firebreak from plantable area, the worst projection sits at about 1.8x. Tightened so the
// suite defends the position actually reached rather than the one it started from.
const MAX_DEFENSIBLE_MULTIPLE = 2.5;

describe('model calibration', () => {
  it('allocates 1.25 rai of planting per rai of ground, not 1.6', () => {
    // The land equivalent ratio IS this sum. 1.6 was the original figure and it alone put the
    // headline 37% too high; the reduction was taken entirely out of the understory layers,
    // where the overlap assumption was doing the most work.
    const ler = Object.values(LAYER_SHARE).reduce((a, b) => a + b, 0);
    expect(ler).toBeCloseTo(1.25, 6);
    expect(LAYER_SHARE.canopy).toBe(0.5);
  });

  it('gives every plan the area budget that ratio implies', () => {
    // Reading it off the plans, not the constant, so a change to how share is computed is
    // caught even when LAYER_SHARE itself is untouched.
    for (const plan of everyPlan()) {
      const allocated = plan.picks.reduce((sum, p) => sum + p.shareRai, 0);
      expect(allocated).toBeGreaterThan(0);
      expect(allocated).toBeLessThanOrEqual(10 * 1.25 + 0.001);
    }
  });

  it('keeps a mixture penalty on understory yield', () => {
    // The weakest number in the engine, and the one most likely to be "simplified" away by
    // someone who does not know it is load-bearing. Anything at or above 1 means intercropped
    // species are assumed to yield as if grown alone, which is what made the first version of
    // this tool project 24x maize.
    expect(MIXTURE_YIELD_FACTOR).toBeGreaterThan(0);
    expect(MIXTURE_YIELD_FACTOR).toBeLessThan(1);
  });

  it('never projects a return that measured Thai plots cannot support', () => {
    const ceiling = HIGHEST_MEASURED_THB_PER_RAI_YEAR * MAX_DEFENSIBLE_MULTIPLE;
    const worst = everyPlan()
      .map((plan) => ({ plan, perRaiYear: plan.profit10 / 10 / 10 }))
      .sort((a, b) => b.perRaiYear - a.perRaiYear)[0];

    expect(
      worst.perRaiYear,
      `highest projection is ${Math.round(worst.perRaiYear)} THB/rai/yr `
      + `(${(worst.perRaiYear / HIGHEST_MEASURED_THB_PER_RAI_YEAR).toFixed(1)}x the highest measured Thai plot). `
      + 'If this is a deliberate model change, move the bound and say why in METHODOLOGY §17.',
    ).toBeLessThan(ceiling);
  });

  it('scales with the land actually planted, not with the size of the number', () => {
    // Per-PLANTABLE-rai must stay flat. If it climbs with area, some cost is being treated as
    // fixed when a farmer pays it per rai, and every big-plot projection is inflated.
    const sizes = [5, 10, 15];
    const perPlantableRai = sizes.map((size) => {
      const best = buildSystems(input(600, 'balanced', size), climate(600), null, null)[0];
      return best.profit10 / plantableRai(input(600, 'balanced', size));
    });
    for (const value of perPlantableRai) {
      expect(value / perPlantableRai[0]).toBeGreaterThan(0.9);
      expect(value / perPlantableRai[0]).toBeLessThan(1.1);
    }
  });

  it('returns less per rai of TITLE on a small plot, because the firebreak takes more of it', () => {
    // Not a defect — the opposite. A perimeter break costs a 5 rai holding 45% of its ground
    // and a 15 rai holding 26%, so the same plan genuinely earns less per deeded rai on the
    // smaller plot. Pinned because the previous version of the test asserted flatness here and
    // would have been "fixed" by removing the firebreak deduction.
    const perTitleRai = [5, 15].map((size) =>
      buildSystems(input(600, 'balanced', size), climate(600), null, null)[0].profit10 / size);
    expect(perTitleRai[1]).toBeGreaterThan(perTitleRai[0]);
    // But not by so much that plot size becomes the dominant driver of the recommendation.
    expect(perTitleRai[1] / perTitleRai[0]).toBeLessThan(1.5);
  });
});
