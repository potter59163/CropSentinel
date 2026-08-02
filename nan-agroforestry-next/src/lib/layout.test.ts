import { describe, it, expect } from 'vitest';
import type { LayerPick, SystemPlan } from '../data/types';
import { stripPlan, firebreakPlan, bambooFireWarning, ALLEY_SWITCH_YEAR } from './layout';

const pick = (over: Partial<LayerPick['plant']> & { layer: LayerPick['layer'] }): LayerPick => ({
  layer: over.layer,
  plant: {
    id: over.id ?? 'x', nameTh: over.nameTh ?? 'พืช', nameEn: 'x',
    layer: over.layer, habit: over.habit ?? 'ไม้ต้น', category: 'x',
    elevMin: 0, elevMax: 2000, perennial: true, yearsToYield: 3, yearsToMature: 6,
    pricePerKg: 10, yieldKgPerRai: 100,
    shadeTol: over.shadeTol ?? 0.5, canopyShade: over.canopyShade ?? 0.5,
    nFixing: false, water: 'med', establishCostPerRai: 0, annualCostPerRai: 0,
    cyclesPerYear: 1, note: '',
  },
  suitability: 0.7, source: 'envelope', modelConfidence: 'expert', shareRai: 1,
  pickedBy: 'system', validationStatus: 'model_suggested',
  scoreParts: { suitability: 0.7, economics: 0.5, waterFit: 0.8, riskFit: 0.8, woodyStructure: 0.5 },
} as unknown as LayerPick);

const sys = (picks: LayerPick[]) => ({ picks }) as unknown as SystemPlan;

describe('strip plan — the teak-over-peanut question', () => {
  // The meeting's exact example: a sun-loving groundcover under a dense canopy.
  const teak = pick({ layer: 'canopy', id: 'teak', nameTh: 'สัก', canopyShade: 0.7 });
  const peanut = pick({ layer: 'groundcover', id: 'peanut', nameTh: 'ถั่วลิสง', shadeTol: 0.35 });
  const ginger = pick({ layer: 'root', id: 'ginger', nameTh: 'ขิง', shadeTol: 0.6 });

  it('splits the alley into sun-lovers now and shade-tolerant later', () => {
    const p = stripPlan(sys([teak, peanut, ginger]));
    expect(p.rowSpecies.map((x) => x.plant.id)).toEqual(['teak']);
    expect(p.alleyEarly.map((x) => x.plant.id)).toEqual(['peanut']);
    expect(p.alleyLate.map((x) => x.plant.id)).toEqual(['ginger']);
  });

  it('names the species that will actually be shaded out', () => {
    const p = stripPlan(sys([teak, peanut, ginger]));
    expect(p.canopyStaysOpen).toBe(false);
    expect(p.shadedOut.map((x) => x.plant.nameTh)).toEqual(['ถั่วลิสง']);
  });

  // A plan whose canopy never closes does not need the year-6 switch, and telling a farmer to
  // rip out a working crop would be actively wrong.
  it('does not force a switch when the canopy stays open', () => {
    const openCanopy = pick({ layer: 'canopy', id: 'cashew', canopyShade: 0.3 });
    const p = stripPlan(sys([openCanopy, peanut]));
    expect(p.canopyStaysOpen).toBe(true);
    expect(p.shadedOut).toEqual([]);
  });

  it('uses the published year-6 switch point', () => {
    expect(ALLEY_SWITCH_YEAR).toBe(6);
  });
});

describe('firebreak — sized by the neighbour, not by the plot', () => {
  it('uses the official 8 m against maize stubble', () => {
    const f = firebreakPlan(10, 'maize');
    expect(f.widthM).toBe(8);
    expect(f.widthNotEnough).toBe(false);
  });

  // Measured on Nan plots: fallow flame length 12.82 m. No achievable break out-reaches that,
  // and pretending a wider strip solves it would be the dangerous answer.
  it('admits a break cannot beat an unmanaged fallow next door', () => {
    const f = firebreakPlan(10, 'fallow');
    expect(f.neighbourFlameM).toBeGreaterThan(f.widthM);
    expect(f.widthNotEnough).toBe(true);
    expect(f.advice.join(' ')).toMatch(/ผู้ใหญ่บ้าน|อบต/);
  });

  it('defaults to the wider break and says the neighbour is unknown', () => {
    const f = firebreakPlan(10);
    expect(f.widthM).toBe(10);
    expect(f.advice.join(' ')).toMatch(/ยังไม่ได้ระบุ/);
  });

  it('reports the productive area the break costs', () => {
    // 10 rai = 16,000 m², a square side is 126.5 m, perimeter 506 m, x 10 m = 5,060 m² ≈ 3.16 rai
    const f = firebreakPlan(10, 'fallow');
    expect(f.areaCostRai).toBeCloseTo(3.16, 1);
    // A smaller plot loses a LARGER share to the same break — worth the farmer knowing.
    const small = firebreakPlan(2, 'fallow');
    expect(small.areaCostRai / 2).toBeGreaterThan(f.areaCostRai / 10);
  });

  it('always tells the farmer to clear to bare soil, not just cut grass', () => {
    expect(firebreakPlan(5, 'maize').advice[0]).toMatch(/เห็นดิน/);
  });

  it('never claims the break costs more land than the plot has', () => {
    // The perimeter formula falls apart on small holdings: a 10 m break around 1 rai works out
    // at 4 rai of border on a 1,600 m² square, which the app printed as "กินพื้นที่ราว 4 ไร่
    // จาก 1 ไร่". The form's minimum is 0.5 rai, so a farmer could reach it.
    for (const size of [0.5, 1, 2, 3, 5]) {
      const f = firebreakPlan(size, 'fallow');
      expect(f.areaCostRai, `${size} rai`).toBeLessThanOrEqual(size);
    }
  });

  it('offers a way out when a full break would eat the plot', () => {
    // Capping the number without changing the advice would just replace an absurd figure with a
    // merely impossible one. A 1 rai holder needs the shared-break and downslope-only options.
    const advice = firebreakPlan(1, 'fallow').advice.join(' ');
    expect(advice).toMatch(/แนวร่วมกับแปลงข้างเคียง/);
    expect(advice).toMatch(/ด้านล่างเนิน/);
    // And a 10 rai plot, where the break IS viable, must not be told to skip it.
    expect(firebreakPlan(10, 'fallow').advice.join(' ')).not.toMatch(/แนวร่วมกับแปลงข้างเคียง/);
  });
});

describe('bamboo is fuel, not a firebreak', () => {
  // The app recommends ไผ่ often, and a farmer could reasonably assume a living green plant
  // protects against fire. RECOFTC's own fire report lists bamboo clumps as high-risk fuel.
  it('warns whenever the plan contains bamboo', () => {
    const w = bambooFireWarning([pick({ layer: 'canopy', id: 'bamboo', habit: 'ไผ่' })]);
    expect(w).toMatch(/ไผ่ไม่ใช่แนวกันไฟ/);
  });

  it('stays silent when there is no bamboo', () => {
    expect(bambooFireWarning([pick({ layer: 'canopy', id: 'mango' })])).toBeNull();
  });
});
