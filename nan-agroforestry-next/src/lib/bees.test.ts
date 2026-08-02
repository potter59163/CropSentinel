import { describe, it, expect } from 'vitest';
import type { LayerPick } from '../data/types';
import {
  beePlan, HIVE_RETURN_THB, HIVE_RETURN_TOTAL, HIVE_RETURN_NO_COLONY_BUYER,
  HIVE_SETUP_THB, HIVES_PER_RAI, FORAGE_RADIUS_M,
} from './bees';

const pick = (id: string, nameTh: string): LayerPick =>
  ({ layer: 'canopy', plant: { id, nameTh }, shareRai: 1 }) as unknown as LayerPick;

describe('ชันโรง economics — the colony-sale dependency must not be hidden', () => {
  // DOAE's own figures: honey 600 + propolis 400 + colony splitting 1,500 = 2,500/hive/yr.
  it('matches the published DOAE split exactly', () => {
    expect(HIVE_RETURN_THB.honey).toBe(600);
    expect(HIVE_RETURN_THB.propolis).toBe(400);
    expect(HIVE_RETURN_THB.colonies).toBe(1500);
    expect(HIVE_RETURN_TOTAL).toBe(2500);
  });

  // The whole reason the split is modelled rather than the headline: 60% of the return is
  // conditional on finding someone to buy split colonies, which DOAE names as a sector
  // weakness. A farmer without that buyer earns 1,000, not 2,500.
  it('shows 60% of the headline depends on a colony buyer', () => {
    expect(HIVE_RETURN_THB.colonies / HIVE_RETURN_TOTAL).toBeCloseTo(0.6, 3);
    expect(HIVE_RETURN_NO_COLONY_BUYER).toBe(1000);
  });

  it('payback stretches from under a year to over a year without a colony buyer', () => {
    expect(HIVE_SETUP_THB / HIVE_RETURN_TOTAL).toBeLessThan(1);
    expect(HIVE_SETUP_THB / HIVE_RETURN_NO_COLONY_BUYER).toBeGreaterThan(1.5);
  });
});

describe('beePlan', () => {
  const plot = [pick('longan', 'ลำไย'), pick('chili', 'พริก'), pick('teak', 'สัก')];

  it('starts small rather than kitting out the whole plot', () => {
    const b = beePlan(10, plot);
    expect(b.fullHives).toBe(10 * HIVES_PER_RAI);
    expect(b.starterHives).toBe(3);
    expect(b.setupCost).toBe(3 * HIVE_SETUP_THB);
  });

  it('quotes both the full return and the no-buyer floor', () => {
    const b = beePlan(10, plot);
    expect(b.returnFull).toBe(3 * 2500);
    expect(b.returnFloor).toBe(3 * 1000);
  });

  it('names only the species in the plan that the bees actually pollinate', () => {
    const b = beePlan(10, plot);
    expect(b.pollinates).toEqual(['ลำไย', 'พริก']); // สัก is wind/insect-irrelevant here
    expect(b.noForage).toBe(false);
  });

  // Hives on a plot with nothing to forage is a bad recommendation, not a neutral one.
  it('flags a plot with no forage species', () => {
    const b = beePlan(10, [pick('teak', 'สัก'), pick('yangna', 'ยางนา')]);
    expect(b.pollinates).toEqual([]);
    expect(b.noForage).toBe(true);
  });

  it('never suggests fewer than one hive, even on a tiny plot', () => {
    expect(beePlan(0.5, plot).fullHives).toBeGreaterThanOrEqual(1);
    expect(beePlan(0, plot).fullHives).toBeGreaterThanOrEqual(1);
  });

  it('uses the DOAE mixed-orchard density and forage radius', () => {
    // 4/rai is the สวนผสม figure; 10/rai is for solid single-species orchards.
    expect(HIVES_PER_RAI).toBe(4);
    expect(FORAGE_RADIUS_M).toBe(300);
  });
});
